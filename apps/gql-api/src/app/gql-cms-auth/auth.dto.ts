// auth.dto.ts
// Data Transfer Objects for gql_cms authentication

export class RegisterDto {
  email!: string;
  password!: string;
  fullName?: string;
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
  user?: {
    id: string;
    email: string;
    fullName: string;
    authProvider: string;
    emailVerified: boolean;
  };
}

export class TokenPayload {
  sub!: string; // User UUID
  email!: string;
  fullName!: string;
  role!: string; // Will be set based on the user_roles table
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export class RefreshTokenPayload {
  sub!: string; // User UUID
  jti!: string; // Token ID
  family!: string; // Token family for rotation
  iat?: number;
  exp?: number;
  iss?: string;
}
