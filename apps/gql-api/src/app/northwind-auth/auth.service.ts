// auth.service.ts
// Authentication service for Northwind ACL

import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { TokenPayload, RefreshTokenPayload } from './auth.dto.ts';

@Injectable()
export class AuthService {
  private pool: Pool;
  private jwtPrivateKey: string;
  private jwtPublicKey: string;

  constructor() {
    // Initialize database connection pool
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Load JWT keys from environment
    this.jwtPrivateKey = process.env.JWT_PRIVATE_KEY || '';
    this.jwtPublicKey = process.env.JWT_PUBLIC_KEY || '';

    if (!this.jwtPrivateKey || !this.jwtPublicKey) {
      console.warn('JWT keys not configured. Generate with: ssh-keygen -t rsa -b 2048 -m PEM -f jwt.key');
    }
  }

  /**
   * Register new user with password
   */
  async register(email: string, password: string, kind: 'customer' | 'employee' = 'customer', displayName?: string) {
    // Hash password with argon2id
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    // Create principal with password credentials
    const result = await this.pool.query(
      'SELECT acl.create_principal_with_password($1, $2, $3, $4) as principal_id',
      [email, passwordHash, kind, displayName]
    );

    const principalId = result.rows[0].principal_id;

    // Get principal details
    const details = await this.getPrincipalDetails(principalId);

    return details;
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string) {
    // Get principal ID and password hash
    const result = await this.pool.query(
      'SELECT acl.find_principal_by_email($1) as principal_id, acl.get_password_hash($1) as password_hash',
      [email]
    );

    if (!result.rows[0] || !result.rows[0].principal_id) {
      throw new Error('Invalid credentials');
    }

    const { principal_id, password_hash } = result.rows[0];

    if (!password_hash) {
      throw new Error('Password authentication not available for this account');
    }

    // Verify password
    const isValid = await argon2.verify(password_hash, password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Get principal details
    const details = await this.getPrincipalDetails(principal_id);

    return details;
  }

  /**
   * Get principal details for JWT generation
   */
  async getPrincipalDetails(principalId: string) {
    const result = await this.pool.query(
      'SELECT * FROM acl.get_principal_details($1)',
      [principalId]
    );

    if (!result.rows[0]) {
      throw new Error('Principal not found');
    }

    return {
      principalId: result.rows[0].principal_id,
      email: result.rows[0].email,
      kind: result.rows[0].kind,
      displayName: result.rows[0].display_name,
      dbRole: result.rows[0].db_role,
      emailVerified: result.rows[0].email_verified,
    };
  }

  /**
   * Issue access + refresh token pair
   */
  async issueTokenPair(principal: {
    principalId: string;
    email: string;
    kind: string;
    dbRole: string;
  }, userAgent?: string, ipAddress?: string) {
    // Generate token family for refresh token rotation
    const tokenFamily = uuidv4();
    const jti = uuidv4();

    // Create access token (short-lived, 15 minutes)
    const accessTokenPayload: TokenPayload = {
      sub: principal.principalId,
      email: principal.email,
      kind: principal.kind,
      role: principal.dbRole,
      iss: 'gql-cms-api',
      aud: 'gql-cms-client',
    };

    const accessToken = jwt.sign(accessTokenPayload, this.jwtPrivateKey, {
      algorithm: 'RS256',
      expiresIn: '15m',
    });

    // Create refresh token (long-lived, 30 days)
    const refreshTokenPayload: RefreshTokenPayload = {
      sub: principal.principalId,
      jti,
      family: tokenFamily,
      iss: 'gql-cms-api',
    };

    const refreshToken = jwt.sign(refreshTokenPayload, this.jwtPrivateKey, {
      algorithm: 'RS256',
      expiresIn: '30d',
    });

    // Store refresh token in database
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await this.pool.query(
      `INSERT INTO acl.refresh_tokens(jti, principal_id, token_family, expires_at, user_agent, ip_address)
       VALUES($1, $2, $3, $4, $5, $6)`,
      [jti, principal.principalId, tokenFamily, expiresAt, userAgent, ipAddress]
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken: string, userAgent?: string, ipAddress?: string) {
    // Verify refresh token
    let payload: RefreshTokenPayload;
    try {
      payload = jwt.verify(refreshToken, this.jwtPublicKey, {
        algorithms: ['RS256'],
      }) as RefreshTokenPayload;
    } catch (err) {
      throw new Error('Invalid or expired refresh token');
    }

    // Check if token is valid in database
    const result = await this.pool.query(
      'SELECT acl.is_token_valid($1) as is_valid',
      [payload.jti]
    );

    if (!result.rows[0].is_valid) {
      // Token is revoked or expired - possible theft, revoke entire family
      await this.pool.query(
        `UPDATE acl.refresh_tokens
         SET revoked_at = now(), revoked_reason = 'token_reuse_detected'
         WHERE token_family = $1 AND revoked_at IS NULL`,
        [payload.family]
      );
      throw new Error('Refresh token has been revoked');
    }

    // Update last_used_at
    await this.pool.query(
      'UPDATE acl.refresh_tokens SET last_used_at = now() WHERE jti = $1',
      [payload.jti]
    );

    // Revoke old refresh token (rotation)
    await this.pool.query(
      `UPDATE acl.refresh_tokens
       SET revoked_at = now(), revoked_reason = 'token_rotated'
       WHERE jti = $1`,
      [payload.jti]
    );

    // Get principal details
    const principal = await this.getPrincipalDetails(payload.sub);

    // Issue new token pair with same family
    const newJti = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create new access token
    const accessTokenPayload: TokenPayload = {
      sub: principal.principalId,
      email: principal.email,
      kind: principal.kind,
      role: principal.dbRole,
      iss: 'gql-cms-api',
      aud: 'gql-cms-client',
    };

    const newAccessToken = jwt.sign(accessTokenPayload, this.jwtPrivateKey, {
      algorithm: 'RS256',
      expiresIn: '15m',
    });

    // Create new refresh token
    const newRefreshTokenPayload: RefreshTokenPayload = {
      sub: principal.principalId,
      jti: newJti,
      family: payload.family, // Same family for rotation tracking
      iss: 'gql-cms-api',
    };

    const newRefreshToken = jwt.sign(newRefreshTokenPayload, this.jwtPrivateKey, {
      algorithm: 'RS256',
      expiresIn: '30d',
    });

    // Store new refresh token
    await this.pool.query(
      `INSERT INTO acl.refresh_tokens(jti, principal_id, token_family, expires_at, user_agent, ip_address)
       VALUES($1, $2, $3, $4, $5, $6)`,
      [newJti, principal.principalId, payload.family, expiresAt, userAgent, ipAddress]
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    };
  }

  /**
   * Logout - revoke single refresh token
   */
  async logout(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, this.jwtPublicKey, {
        algorithms: ['RS256'],
      }) as RefreshTokenPayload;

      await this.pool.query('SELECT acl.revoke_token($1)', [payload.jti]);
    } catch (err) {
      // Token invalid or already expired - no-op
    }
  }

  /**
   * Logout all devices - revoke all tokens for principal
   */
  async logoutAll(principalId: string) {
    await this.pool.query('SELECT acl.revoke_principal_tokens($1)', [principalId]);
  }

  /**
   * Verify access token (used by middleware)
   */
  verifyAccessToken(token: string): TokenPayload | null {
    try {
      const payload = jwt.verify(token, this.jwtPublicKey, {
        algorithms: ['RS256'],
      }) as TokenPayload;
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * OAuth: Upsert OAuth identity (called after OAuth callback)
   */
  async upsertOAuthIdentity(
    provider: string,
    providerSub: string,
    providerEmail: string,
    profileData: any,
    kind: 'customer' | 'employee' = 'customer',
    displayName?: string
  ) {
    const result = await this.pool.query(
      'SELECT acl.upsert_oauth_identity($1, $2, $3, $4, $5, $6) as principal_id',
      [provider, providerSub, providerEmail, JSON.stringify(profileData), kind, displayName]
    );

    const principalId = result.rows[0].principal_id;
    const details = await this.getPrincipalDetails(principalId);

    return details;
  }

  /**
   * Change password
   */
  async changePassword(principalId: string, newPassword: string) {
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.pool.query('SELECT acl.update_password($1, $2)', [principalId, passwordHash]);
  }

  /**
   * Verify email
   */
  async verifyEmail(principalId: string) {
    await this.pool.query('SELECT acl.verify_email($1)', [principalId]);
  }
}
