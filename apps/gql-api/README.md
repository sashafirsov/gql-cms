# GraphQL API (gql-api)

NestJS GraphQL API server using PostGraphile middleware for auto-generated GraphQL schema from PostgreSQL.

## Architecture

- **Framework**: NestJS
- **GraphQL**: PostGraphile (auto-generates schema from PostgreSQL)
- **Authentication**: JWT with HttpOnly cookies
- **Authorization**: PostgreSQL Row-Level Security (RLS)
- **Database**: PostgreSQL with ACL schema

## Authentication System

The API includes two authentication systems:

### 1. GQL-CMS Authentication (`/graphql`)
- Original authentication for the gql-cms schema
- Endpoints: TBD (future implementation)

### 2. Northwind Authentication (`/northwind/auth/*`)
- Complete authentication system for Northwind ACL
- Password-based authentication with argon2id hashing
- JWT token-based sessions with HttpOnly cookies
- Token rotation with family tracking
- OAuth/OIDC support (planned)

## Environment Setup

### 1. Create Environment File

Copy the example environment file:
```bash
cp ../../.env.example ../../.env
```

### 2. Generate JWT Keys

JWT keys are **automatically generated** during the build process:
```bash
npm run build
```

This runs `bin/jwt_keys.sh` which:
- Generates a 2048-bit RSA key pair using OpenSSL
- Stores keys in `.env` as `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY`
- Keys are formatted as single-line strings with escaped newlines

**Manual generation** (if needed):
```bash
bash bin/jwt_keys.sh
```

**Important Security Notes**:
- ⚠️ `.env` file is in `.gitignore` and should **never** be committed
- ⚠️ JWT keys are sensitive credentials - keep them secure
- ⚠️ Generate new keys for each environment (dev, staging, production)
- ⚠️ Rotate keys periodically for production environments

### 3. Configure Database Connection

Set `DATABASE_URL` in `.env`:
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/gql_cms
```

### 4. Environment Variables Reference

| Variable | Description | Auto-Generated |
|----------|-------------|----------------|
| `DATABASE_URL` | PostgreSQL connection string | ❌ Manual |
| `NODE_ENV` | Environment (development/production) | ❌ Manual |
| `PORT` | API server port (default: 5433) | ❌ Manual |
| `JWT_PRIVATE_KEY` | RSA private key for signing JWTs | ✅ Auto (build) |
| `JWT_PUBLIC_KEY` | RSA public key for verifying JWTs | ✅ Auto (build) |

## Development

### Start Development Server

```bash
# From project root
npm run build  # Generates JWT keys and builds
nx serve gql-api

# API available at: http://localhost:5433
# GraphiQL available at: http://localhost:5433/graphiql
```

### Build for Production

```bash
nx build gql-api
```

Build output: `dist/apps/gql-api/`

## Authentication Endpoints

### Northwind Authentication (`/northwind/auth/*`)

#### Register New User
```bash
POST /northwind/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "kind": "customer",  # or "employee"
  "displayName": "John Doe"
}

Response: 201 Created
{
  "success": true,
  "message": "Registration successful",
  "principal": {
    "id": "uuid",
    "email": "user@example.com",
    "kind": "customer",
    "displayName": "John Doe",
    "emailVerified": false
  }
}

Cookies Set:
- access_token (HttpOnly, 15 min, Path=/)
- refresh_token (HttpOnly, 30 days, Path=/northwind/auth)
```

#### Login
```bash
POST /northwind/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response: 200 OK
{
  "success": true,
  "message": "Login successful",
  "principal": { ... }
}

Cookies Set:
- access_token (HttpOnly, 15 min, Path=/)
- refresh_token (HttpOnly, 30 days, Path=/northwind/auth)
```

#### Refresh Access Token
```bash
POST /northwind/auth/refresh

# Reads refresh_token from cookies automatically

Response: 200 OK
{
  "success": true,
  "message": "Token refreshed"
}

Cookies Updated:
- New access_token
- New refresh_token (old token revoked)
```

#### Get Current User
```bash
GET /northwind/auth/me

# Requires valid access_token cookie

Response: 200 OK
{
  "success": true,
  "principal": {
    "id": "uuid",
    "email": "user@example.com",
    "kind": "customer",
    "displayName": "John Doe",
    "emailVerified": false,
    "role": "app_user"
  }
}
```

#### Logout (Current Device)
```bash
POST /northwind/auth/logout

Response: 200 OK
{
  "success": true,
  "message": "Logout successful"
}

Cookies Cleared:
- access_token
- refresh_token
```

#### Logout All Devices
```bash
POST /northwind/auth/logout-all

# Requires valid access_token cookie

Response: 200 OK
{
  "success": true,
  "message": "Logged out from all devices"
}

# Revokes all refresh tokens for the user
```

## GraphQL Endpoint

### `/graphql`

PostGraphile automatically generates GraphQL schema from PostgreSQL:
- **Schema**: `gql_cms` (configured in `app.module.ts`)
- **RLS Enforcement**: Row-Level Security policies enforced via `pgSettings`
- **Role Mapping**: JWT `role` field maps to PostgreSQL roles (`app_user`, `app_admin`, `app_readonly`, `anonymous`)

#### Authentication Flow

1. Client authenticates via `/northwind/auth/login`
2. Server sets HttpOnly cookies (`access_token`, `refresh_token`)
3. `AuthMiddleware` verifies JWT from cookie on each request
4. PostGraphile's `pgSettings` maps JWT to PostgreSQL session:
   ```typescript
   pgSettings: async (req) => {
     const auth = req.auth ?? { role: 'anonymous' };
     return {
       role: auth.role,                         // PostgreSQL role
       'app.principal_id': auth.userId ?? null, // For acl.current_principal()
       'jwt.claims.user_id': auth.userId ?? null,
       'jwt.claims.email': auth.email ?? null,
       'jwt.claims.scopes': (auth.scopes ?? []).join(','),
     };
   }
   ```
5. PostgreSQL enforces RLS policies based on role and principal

#### Example GraphQL Query

```graphql
# GraphiQL: http://localhost:5433/graphiql

query GetCustomers {
  allCustomers {
    nodes {
      customerId
      companyName
      contactName
    }
  }
}

# Results filtered by RLS policies based on authenticated user
```

## Testing

### Unit Tests
```bash
nx test gql-api
```

### E2E Tests
```bash
nx e2e gql-api-e2e
```

### Manual API Testing

#### Test Authentication Flow
```bash
# 1. Register
curl -c cookies.txt -X POST http://localhost:5433/northwind/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!","kind":"customer"}'

# 2. Login
curl -c cookies.txt -X POST http://localhost:5433/northwind/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# 3. Get current user (uses cookies)
curl -b cookies.txt http://localhost:5433/northwind/auth/me

# 4. Test GraphQL with authentication
curl -b cookies.txt -X POST http://localhost:5433/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ allCustomers { nodes { customerId companyName } } }"}'

# 5. Logout
curl -b cookies.txt -c cookies.txt -X POST http://localhost:5433/northwind/auth/logout
```

## Security Considerations

### JWT Token Security
- **Algorithm**: RS256 (RSA SHA-256)
- **Private Key**: Used to sign tokens (keep secure, never expose)
- **Public Key**: Used to verify tokens (can be shared with other services)
- **Access Token Lifetime**: 15 minutes (short-lived)
- **Refresh Token Lifetime**: 30 days (long-lived, revocable)

### Cookie Security
- **HttpOnly**: Prevents JavaScript access (XSS protection)
- **Secure**: Only sent over HTTPS in production
- **SameSite=Lax**: CSRF protection
- **Path Restrictions**:
  - `access_token`: Path=/ (all endpoints)
  - `refresh_token`: Path=/northwind/auth (auth endpoints only)

### Password Security
- **Hashing**: argon2id (memory-hard, GPU-resistant)
- **Parameters**: 64MB memory, 3 iterations, 4 parallelism
- **No Plaintext Storage**: Only hashes stored in database
- **Rate Limiting**: Recommended for production (5 attempts per 15 min)

### Token Rotation
- **Refresh Token Rotation**: New token issued on every refresh, old token revoked
- **Family Tracking**: Detects token replay attacks
- **Automatic Revocation**: If stolen token reused, entire family revoked

### Database Security
- **RLS Enforcement**: All auth tables have Row-Level Security enabled
- **Principal Isolation**: Users can only see their own credentials
- **Admin Override**: `app_admin` role can bypass RLS for management
- **Audit Trail**: All token issuance/revocation logged in `acl.refresh_tokens`

## Project Structure

```
apps/gql-api/
├── src/
│   ├── app/
│   │   ├── northwind-auth/       # Northwind authentication module
│   │   │   ├── auth.module.ts    # NestJS module
│   │   │   ├── auth.controller.ts # Auth endpoints
│   │   │   ├── auth.service.ts   # Auth business logic
│   │   │   └── auth.dto.ts       # Data transfer objects
│   │   ├── app.module.ts         # Main application module
│   │   ├── app.controller.ts     # Application controller
│   │   ├── app.service.ts        # Application service
│   │   └── auth.middleware.ts    # JWT verification middleware
│   ├── assets/                   # Static assets
│   └── main.ts                   # Application entry point
├── package.json
├── tsconfig.json
├── webpack.config.js
└── README.md (this file)
```

## Dependencies

### Runtime Dependencies
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` - NestJS framework
- `postgraphile` - GraphQL schema auto-generation
- `pg` - PostgreSQL client
- `argon2` - Password hashing
- `jsonwebtoken` - JWT signing and verification
- `uuid` - UUID generation
- `cookie-parser` - Cookie parsing middleware

### Development Dependencies
- `@nestjs/testing` - NestJS testing utilities
- `@types/jsonwebtoken`, `@types/uuid`, `@types/cookie-parser` - TypeScript types

## Troubleshooting

### Issue: "JWT keys not configured" warning

**Solution**: Run `npm run build` or `bash bin/jwt_keys.sh` to generate keys

### Issue: "Invalid or expired refresh token"

**Causes**:
- Token expired (> 30 days old)
- Token revoked (logout or security event)
- Token family revoked (replay attack detected)

**Solution**: Login again to get new tokens

### Issue: GraphQL returns empty results despite data existing

**Causes**:
- Not authenticated (missing `access_token` cookie)
- RLS policies restrict access for current principal
- Wrong PostgreSQL role assigned

**Solution**:
1. Verify authentication: `GET /northwind/auth/me`
2. Check PostgreSQL role in response
3. Verify RLS policies in `apps/db-init/db/init/70-northwind-acl-schema.sql`

### Issue: "Database connection failed"

**Solution**:
1. Check `DATABASE_URL` in `.env`
2. Ensure PostgreSQL is running: `docker-compose up gql-cms-db`
3. Verify database exists: `psql $DATABASE_URL`

## References

- [NestJS Documentation](https://docs.nestjs.com/)
- [PostGraphile Documentation](https://www.graphile.org/postgraphile/)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [argon2 Documentation](https://github.com/P-H-C/phc-winner-argon2)
- [Northwind ACL Documentation](../../apps/db-init/db/Northwind.md)
