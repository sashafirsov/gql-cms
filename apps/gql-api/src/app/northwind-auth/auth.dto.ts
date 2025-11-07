// auth.dto.ts
// Data Transfer Objects for Northwind authentication

export class RegisterDto {
  email!: string;
  password!: string;
  kind?: 'customer' | 'employee';
  displayName?: string;
}

export class LoginDto {
  email!: string;
  password!: string;
}

export class RefreshDto {
  // Refresh token comes from HttpOnly cookie
}

export class AuthResponse {
  success!: boolean;
  message?: string;
  principal?: {
    id: string;
    email: string;
    kind: string;
    displayName: string;
    emailVerified: boolean;
  };
}

export class TokenPayload {
  sub!: string; // Principal UUID
  email!: string;
  kind!: string;
  role!: string; // PostgreSQL role (app_user, app_admin, app_readonly)
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export class RefreshTokenPayload {
  sub!: string; // Principal UUID
  jti!: string; // Token ID
  family!: string; // Token family for rotation
  iat?: number;
  exp?: number;
  iss?: string;
}
