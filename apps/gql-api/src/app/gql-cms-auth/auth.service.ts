// auth.service.ts
// Authentication service for gql_cms

import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import type { TokenPayload, RefreshTokenPayload } from './auth.dto.ts';

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
  async register(email: string, password: string, fullName?: string) {
    // Hash password with argon2id
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    // Create user with password credentials
    const result = await this.pool.query(
      'SELECT gql_cms.create_user_with_password($1, $2, $3) as user_id',
      [email, passwordHash, fullName]
    );

    const userId = result.rows[0].user_id;

    // Get user details
    const details = await this.getUserDetails(userId);

    return details;
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string) {
    // Get user ID and password hash
    const result = await this.pool.query(
      'SELECT gql_cms.find_user_by_email($1) as user_id, gql_cms.get_password_hash($1) as password_hash',
      [email]
    );

    if (!result.rows[0] || !result.rows[0].user_id) {
      throw new Error('Invalid credentials');
    }

    const { user_id, password_hash } = result.rows[0];

    if (!password_hash) {
      throw new Error('Password authentication not available for this account');
    }

    // Verify password
    const isValid = await argon2.verify(password_hash, password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Get user details
    const details = await this.getUserDetails(user_id);

    return details;
  }

  /**
   * Get user details for JWT generation
   */
  async getUserDetails(userId: string) {
    const result = await this.pool.query(
      'SELECT * FROM gql_cms.get_user_details($1)',
      [userId]
    );

    if (!result.rows[0]) {
      throw new Error('User not found');
    }

    // Check if user has any global roles
    const roleResult = await this.pool.query(
      `SELECT role_name FROM gql_cms.user_roles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    const role = roleResult.rows[0]?.role_name || 'user';

    return {
      userId: result.rows[0].user_id,
      email: result.rows[0].email,
      fullName: result.rows[0].full_name,
      authProvider: result.rows[0].auth_provider,
      emailVerified: result.rows[0].email_verified,
      role,
    };
  }

  /**
   * Issue access + refresh token pair
   */
  async issueTokenPair(user: {
    userId: string;
    email: string;
    fullName: string;
    role: string;
  }, userAgent?: string, ipAddress?: string) {
    // Generate token family for refresh token rotation
    const tokenFamily = uuidv4();
    const jti = uuidv4();

    // Create access token (short-lived, 15 minutes)
    const accessTokenPayload: TokenPayload = {
      sub: user.userId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      iss: 'gql-cms-api',
      aud: 'gql-cms-client',
    };

    const accessToken = jwt.sign(accessTokenPayload, this.jwtPrivateKey, {
      algorithm: 'RS256',
      expiresIn: '15m',
    });

    // Create refresh token (long-lived, 30 days)
    const refreshTokenPayload: RefreshTokenPayload = {
      sub: user.userId,
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
      `INSERT INTO gql_cms.refresh_tokens(jti, user_id, token_family, expires_at, user_agent, ip_address)
       VALUES($1, $2, $3, $4, $5, $6)`,
      [jti, user.userId, tokenFamily, expiresAt, userAgent, ipAddress]
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
      'SELECT gql_cms.is_token_valid($1) as is_valid',
      [payload.jti]
    );

    if (!result.rows[0].is_valid) {
      // Token is revoked or expired - possible theft, revoke entire family
      await this.pool.query(
        `UPDATE gql_cms.refresh_tokens
         SET revoked_at = now(), revoked_reason = 'token_reuse_detected'
         WHERE token_family = $1 AND revoked_at IS NULL`,
        [payload.family]
      );
      throw new Error('Refresh token has been revoked');
    }

    // Update last_used_at
    await this.pool.query(
      'UPDATE gql_cms.refresh_tokens SET last_used_at = now() WHERE jti = $1',
      [payload.jti]
    );

    // Revoke old refresh token (rotation)
    await this.pool.query(
      `UPDATE gql_cms.refresh_tokens
       SET revoked_at = now(), revoked_reason = 'token_rotated'
       WHERE jti = $1`,
      [payload.jti]
    );

    // Get user details
    const user = await this.getUserDetails(payload.sub);

    // Issue new token pair with same family
    const newJti = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create new access token
    const accessTokenPayload: TokenPayload = {
      sub: user.userId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      iss: 'gql-cms-api',
      aud: 'gql-cms-client',
    };

    const newAccessToken = jwt.sign(accessTokenPayload, this.jwtPrivateKey, {
      algorithm: 'RS256',
      expiresIn: '15m',
    });

    // Create new refresh token
    const newRefreshTokenPayload: RefreshTokenPayload = {
      sub: user.userId,
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
      `INSERT INTO gql_cms.refresh_tokens(jti, user_id, token_family, expires_at, user_agent, ip_address)
       VALUES($1, $2, $3, $4, $5, $6)`,
      [newJti, user.userId, payload.family, expiresAt, userAgent, ipAddress]
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

      await this.pool.query('SELECT gql_cms.revoke_token($1)', [payload.jti]);
    } catch (err) {
      // Token invalid or already expired - no-op
    }
  }

  /**
   * Logout all devices - revoke all tokens for user
   */
  async logoutAll(userId: string) {
    await this.pool.query('SELECT gql_cms.revoke_user_tokens($1)', [userId]);
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
    fullName?: string
  ) {
    const result = await this.pool.query(
      'SELECT gql_cms.upsert_oauth_identity($1, $2, $3, $4, $5) as user_id',
      [provider, providerSub, providerEmail, JSON.stringify(profileData), fullName]
    );

    const userId = result.rows[0].user_id;
    const details = await this.getUserDetails(userId);

    return details;
  }

  /**
   * Change password
   */
  async changePassword(userId: string, newPassword: string) {
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.pool.query('SELECT gql_cms.update_password($1, $2)', [userId, passwordHash]);
  }

  /**
   * Verify email
   */
  async verifyEmail(userId: string) {
    await this.pool.query('SELECT gql_cms.verify_email($1)', [userId]);
  }
}
