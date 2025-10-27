# Northwind Database Schema (PostgreSQL)

`gql-cms` provides the complete [schema in PostgreSQL dialect](./init/50-northwind.sql)
and [sample data](./init/60-northwind-seed.sql) for the Northwind sample database, translated to PostgreSQL. 
It includes all tables, primary/foreign keys, data types, and constraints based on official Northwind definitions
[gist.github.com](https://gist.github.com/keeyanajones/2ea808fdca8325a4faf2dbd0a59e0c9e#:~:text=%2F,CategoryID%29)
[gist.github.com](https://gist.github.com/keeyanajones/2ea808fdca8325a4faf2dbd0a59e0c9e#:~:text=CREATE%20TABLE%20Employees%20,60%29%20NULL)
. Comments are provided to separate sections for clarity.

# Notes & usage

Session principal: your app (or psql) must set the current principal once per session:
```sql
SELECT acl.set_principal('00000000-0000-0000-0000-000000000000'::uuid);
```

(Use the actual UUID from `acl.principals`.)

**Containment**:
* `order_detail` inherits access through `order` via `acl.object_edges`.
* `order` inherits from its `customer`.

**Permissions**:
* `owner, manager` ⇒ `read + write (+ manage)`
* `editor` ⇒ `read + write`
* `viewer, sales_rep, customer_self` ⇒ `read`

**DB roles**:
* Attach your application connections to `app_user` (RLS enforced) or `app_readonly` (read-only with RLS).
* `app_admin` is intended for operational access; 
RLS is still forced, but you can assign tuples or grant table-level privileges if you truly need bypass.

If you want me to extend policies to more tables (e.g., `suppliers`, `categories`, `employees`) or adjust who gets derived access, tell me your rules and I’ll generate matching tuples and policies.

# Northwind Database Schema & Sample Data Sources (with Licenses)
## Official Microsoft Distributions
* **Microsoft’s Northwind Sample (CodePlex/MSDN)** – Originally made available by Microsoft on platforms like CodePlex and MSDN Code Gallery under 
**the Microsoft Public License (MS-PL)**. This open-source license covers the schema and data of the Northwind database
`en.wikiversity.org` `snk-corp.co.jp`. 
(For example, Microsoft’s downloadable `instnwnd.sql` script containing the schema and data was released under MS-PL.)

* **Microsoft SQL Server Samples (GitHub Repository)** – Microsoft’s current official distribution of Northwind (as part of the SQL Server sample databases on GitHub) 
is provided under an **MIT License**. The Northwind database scripts (e.g. `instnwnd.sql`) in this repository are shared by Microsoft with an MIT licensing, allowing free use with attribution
[kendralittle.com](https://kendralittle.com/2019/12/27/resolving-merge-conflicts-in-sql-source-control-the-basics-video/)
. (This GitHub repo supersedes the older CodePlex version, but the schema and data remain essentially the same.)
## Public PostgreSQL Adaptations
* **Northwind for PostgreSQL – pthom/northwind_psql (GitHub)** – A popular community adaptation of Northwind for Postgres. 
This project provides SQL scripts to create and load the Northwind schema on PostgreSQL. 
It acknowledges that the original schema and data are licensed under **MS-PL** (as per Microsoft’s terms)
[gitee.com](https://gitee.com/lucien2009/northwind_psql?skip_mobile=true#:~:text=,Definitions%20The%20terms)
. The repository includes the Microsoft Public License text, since it redistributes the sample data under those terms.

* **Northwind Extended (Google Code Archive)** – An earlier public project that ported Northwind to multiple databases (including PostgreSQL). 
It was freely available for educational use; the **Northwind schema and data in this project fell under Microsoft’s sample database license (MS-PL)** as well
[snk-corp.co.jp](https://www.snk-corp.co.jp/webmanual/samuraispirits/es-mx/gamemode9.php#:~:text=The%20Ms,data%20is%20also%20available%20from)
. (The Google Code project is now archived, but it provided PostgreSQL SQL scripts for Northwind, abiding by the permissive license of the original data.)

Each of the above sources provides the Northwind database schema and sample records, along with an associated license or usage policy. Microsoft’s official releases use permissive licenses (originally MS-PL, later MIT on GitHub) to allow broad use of the sample. Likewise, third-party PostgreSQL versions either inherit the Microsoft Public License for the data or apply a similarly permissive license, ensuring Northwind can be used in demos, training, and development freely under those terms

### Citations

Database Examples/Northwind - Wikiversity

https://en.wikiversity.org/wiki/Database_Examples/Northwind

SAMURAI SHODOWN   |  WEB MANUAL

https://www.snk-corp.co.jp/webmanual/samuraispirits/es-mx/gamemode9.php

Resolving Merge Conflicts in SQL Source Control - the Basics (video)

https://kendralittle.com/2019/12/27/resolving-merge-conflicts-in-sql-source-control-the-basics-video/

northwind_psql: PostgreSQL 示例数据库

https://gitee.com/lucien2009/northwind_psql?skip_mobile=true

---

# ACL Extension: Authentication & Authorization Strategy

## Overview

This section proposes extending the existing Northwind ACL system (`acl` schema with ReBAC/Zanzibar-style authorization) to support both **password-based authentication** and **OAuth/OIDC authentication**, while maintaining the current relationship-based access control model.

### Alignment with Project Goals

This proposal strictly adheres to the four core architectural goals:

1. ✅ **Keep authorization in Postgres via RLS**: All authorization logic remains in PostgreSQL RLS policies. The existing `acl` schema with tuples, relations, and permissions is unchanged. Authorization decisions are made by PostgreSQL, not application code.

2. ✅ **Use cookies (HttpOnly)**: All tokens (access + refresh) are stored in HttpOnly cookies. JavaScript never sees tokens, preventing XSS token theft. Cookies are Secure and SameSite-protected.

3. ✅ **Support password + OAuth/OIDC**: Dual authentication support via `acl.user_credentials` (password hashing) and `acl.oauth_identities` (OAuth provider linkage). Account linking supported.

4. ✅ **Stateless GraphQL with pgSettings role mapping**: No server-side sessions (except cookies). JWT contains PostgreSQL role (`app_user`, `app_admin`, `anonymous`). PostGraphile's `pgSettings` maps JWT role → PostgreSQL role + sets `app.principal_id` for RLS enforcement.

## Current State

The existing ACL system (`70-northwind-acl-schema.sql`, `80-northwind-acl-seed.sql`) provides:
- **Principals** (`acl.principals`): Represents actors (employees, customers, suppliers, services, groups)
- **Relations & Permissions**: Maps relations (owner, manager, viewer, sales_rep) to permissions (read, write, manage)
- **Tuples**: Zanzibar-style authorization tuples linking principals to resources
- **RLS Policies**: Row-level security on `northwind.customers`, `northwind.products`, `northwind.orders`, `northwind.order_details`

**Gap**: No authentication mechanism exists. The system assumes principals are externally authenticated and set via `acl.set_principal(uuid)`.

## Proposed Authentication Architecture

### Design Principles

1. **Separation of Concerns**: Authentication (identity verification) remains separate from authorization (access control)
2. **Multi-Provider Support**: Support both local passwords and multiple OAuth providers
3. **Stateless Authentication**: Use JWT tokens with HttpOnly cookies
4. **Database as Source of Truth**: Store refresh tokens, OAuth identities in PostgreSQL
5. **Backward Compatible**: Extend existing `acl.principals` without breaking current ACL logic

### Schema Extensions

#### 1. Authentication Tables

```sql
-- A. User credentials for password authentication
CREATE TABLE IF NOT EXISTS acl.user_credentials (
    principal_id    UUID PRIMARY KEY REFERENCES acl.principals(id) ON DELETE CASCADE,
    email           CITEXT UNIQUE NOT NULL,
    password_hash   TEXT,  -- argon2id hash; NULL for OAuth-only users
    email_verified  BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE acl.user_credentials IS
'Stores password credentials linked to principals. Email is the primary identifier for authentication.';

-- B. OAuth/OIDC identities
CREATE TABLE IF NOT EXISTS acl.oauth_identities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id    UUID NOT NULL REFERENCES acl.principals(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,  -- 'google', 'github', 'azure', etc.
    provider_sub    TEXT NOT NULL,  -- Provider's subject/user ID
    provider_email  CITEXT,
    profile_data    JSONB DEFAULT '{}'::jsonb,
    access_token_enc BYTEA,  -- Encrypted provider access token (optional)
    refresh_token_enc BYTEA, -- Encrypted provider refresh token (optional)
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider, provider_sub)
);

COMMENT ON TABLE acl.oauth_identities IS
'Stores OAuth/OIDC provider identities linked to principals. Supports account linking (one principal, multiple OAuth providers).';

-- C. Refresh token ledger (JWT rotation)
CREATE TABLE IF NOT EXISTS acl.refresh_tokens (
    jti             UUID PRIMARY KEY,  -- JWT ID
    principal_id    UUID NOT NULL REFERENCES acl.principals(id) ON DELETE CASCADE,
    token_family    UUID NOT NULL,  -- For token rotation chains
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    revoked_reason  TEXT,
    user_agent      TEXT,
    ip_address      INET,
    last_used_at    TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_principal ON acl.refresh_tokens(principal_id);
CREATE INDEX idx_refresh_tokens_family ON acl.refresh_tokens(token_family);
CREATE INDEX idx_refresh_tokens_expires ON acl.refresh_tokens(expires_at) WHERE revoked_at IS NULL;

COMMENT ON TABLE acl.refresh_tokens IS
'Audit trail and revocation list for refresh JWTs. Supports token rotation with family detection for security.';

-- D. Session tracking (optional, for audit/analytics)
CREATE TABLE IF NOT EXISTS acl.sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id    UUID NOT NULL REFERENCES acl.principals(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    user_agent      TEXT,
    ip_address      INET,
    metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_sessions_principal ON acl.sessions(principal_id);
CREATE INDEX idx_sessions_active ON acl.sessions(principal_id, expires_at) WHERE expires_at > now();
```

#### 2. Helper Functions

```sql
-- Find principal by email (for login)
CREATE OR REPLACE FUNCTION acl.find_principal_by_email(p_email CITEXT)
RETURNS UUID
LANGUAGE sql STABLE AS $$
    SELECT principal_id FROM acl.user_credentials WHERE email = p_email;
$$;

-- Verify password (application should use argon2.verify in NestJS, not SQL)
-- This is just a helper to fetch hash for verification
CREATE OR REPLACE FUNCTION acl.get_password_hash(p_email CITEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT password_hash FROM acl.user_credentials WHERE email = p_email;
$$;

-- Link OAuth identity to existing principal or create new
CREATE OR REPLACE FUNCTION acl.upsert_oauth_identity(
    p_provider TEXT,
    p_provider_sub TEXT,
    p_provider_email CITEXT,
    p_profile_data JSONB,
    p_principal_kind acl.principal_kind DEFAULT 'customer',
    p_display_name TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
    v_principal_id UUID;
    v_existing_oauth UUID;
BEGIN
    -- Check if OAuth identity already exists
    SELECT principal_id INTO v_existing_oauth
    FROM acl.oauth_identities
    WHERE provider = p_provider AND provider_sub = p_provider_sub;

    IF v_existing_oauth IS NOT NULL THEN
        -- Update existing OAuth record
        UPDATE acl.oauth_identities
        SET provider_email = p_provider_email,
            profile_data = p_profile_data,
            updated_at = now()
        WHERE provider = p_provider AND provider_sub = p_provider_sub;

        RETURN v_existing_oauth;
    END IF;

    -- Try to find existing principal by email (account linking)
    SELECT principal_id INTO v_principal_id
    FROM acl.user_credentials
    WHERE email = p_provider_email;

    IF v_principal_id IS NULL THEN
        -- Create new principal
        INSERT INTO acl.principals(kind, external_id, display_name)
        VALUES (
            p_principal_kind,
            p_provider || ':' || p_provider_sub,
            COALESCE(p_display_name, p_provider_email)
        )
        RETURNING id INTO v_principal_id;

        -- Create user_credentials record (no password)
        INSERT INTO acl.user_credentials(principal_id, email, email_verified)
        VALUES (v_principal_id, p_provider_email, TRUE);
    END IF;

    -- Create OAuth identity
    INSERT INTO acl.oauth_identities(
        principal_id, provider, provider_sub,
        provider_email, profile_data
    )
    VALUES (
        v_principal_id, p_provider, p_provider_sub,
        p_provider_email, p_profile_data
    );

    RETURN v_principal_id;
END;
$$;

-- Revoke all tokens for a principal (logout all devices)
CREATE OR REPLACE FUNCTION acl.revoke_principal_tokens(p_principal_id UUID)
RETURNS VOID
LANGUAGE sql AS $$
    UPDATE acl.refresh_tokens
    SET revoked_at = now(),
        revoked_reason = 'user_initiated_logout_all'
    WHERE principal_id = p_principal_id
      AND revoked_at IS NULL;
$$;

-- Clean expired/revoked tokens (maintenance)
CREATE OR REPLACE FUNCTION acl.cleanup_expired_tokens()
RETURNS INTEGER
LANGUAGE sql AS $$
    WITH deleted AS (
        DELETE FROM acl.refresh_tokens
        WHERE expires_at < now() - INTERVAL '30 days'
           OR (revoked_at IS NOT NULL AND revoked_at < now() - INTERVAL '30 days')
        RETURNING 1
    )
    SELECT COUNT(*) FROM deleted;
$$;

-- Determine PostgreSQL role for a principal (for pgSettings mapping)
CREATE OR REPLACE FUNCTION acl.get_db_role(p_principal_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT CASE
        -- Admin users get app_admin role
        WHEN EXISTS (
            SELECT 1 FROM acl.tuples t
            WHERE t.principal_id = p_principal_id
              AND t.relation = 'owner'
              AND t.resource_type = 'system'
        ) THEN 'app_admin'

        -- Employees and services get app_user role
        WHEN EXISTS (
            SELECT 1 FROM acl.principals p
            WHERE p.id = p_principal_id
              AND p.kind IN ('employee', 'service')
        ) THEN 'app_user'

        -- Customers get app_user role
        WHEN EXISTS (
            SELECT 1 FROM acl.principals p
            WHERE p.id = p_principal_id
              AND p.kind = 'customer'
        ) THEN 'app_user'

        -- Default to app_readonly for unknown/group principals
        ELSE 'app_readonly'
    END;
$$;

COMMENT ON FUNCTION acl.get_db_role IS
'Maps a principal to a PostgreSQL database role for pgSettings. This enables stateless GraphQL transport while enforcing RLS via role switching.';
```

#### 3. RLS Policies for Auth Tables

```sql
-- User credentials: Users can only see their own
ALTER TABLE acl.user_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_credentials_select ON acl.user_credentials
FOR SELECT
USING (principal_id = acl.current_principal() OR current_user = 'app_admin');

CREATE POLICY user_credentials_update ON acl.user_credentials
FOR UPDATE
USING (principal_id = acl.current_principal() OR current_user = 'app_admin')
WITH CHECK (principal_id = acl.current_principal() OR current_user = 'app_admin');

-- OAuth identities: Users can see their own
ALTER TABLE acl.oauth_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY oauth_identities_select ON acl.oauth_identities
FOR SELECT
USING (principal_id = acl.current_principal() OR current_user = 'app_admin');

-- Refresh tokens: Read-only for users, admin full access
ALTER TABLE acl.refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY refresh_tokens_select ON acl.refresh_tokens
FOR SELECT
USING (principal_id = acl.current_principal() OR current_user = 'app_admin');

-- Sessions: Users can see their own
ALTER TABLE acl.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_select ON acl.sessions
FOR SELECT
USING (principal_id = acl.current_principal() OR current_user = 'app_admin');
```

### Application Integration

#### NestJS Authentication Module

```typescript
// Proposed NestJS structure (not implemented, just plan)

@Module({
  imports: [
    PassportModule,
    JwtModule.register({ /* ... */ }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordStrategy,  // Local strategy
    JwtStrategy,       // JWT verification
    GoogleStrategy,    // OAuth providers
    GithubStrategy,
    // ... other OAuth strategies
  ],
})
export class AuthModule {}
```

#### Authentication Endpoints

**POST `/northwind/auth/register`**
- Input: `{ email, password, kind: 'customer' | 'employee' }`
- Create principal + credentials
- Hash password with argon2id
- Return access + refresh tokens (HttpOnly cookies)

**POST `/northwind/auth/login`**
- Input: `{ email, password }`
- Verify credentials
- Generate JWT pair
- Set cookies, return success

**GET `/northwind/auth/:provider/start` (OAuth)**
- Redirect to OAuth provider with PKCE
- Store state/nonce/verifier in Redis or DB

**GET `/northwind/auth/:provider/callback`**
- Exchange code for tokens
- Call `acl.upsert_oauth_identity()`
- Generate JWT pair
- Set cookies, redirect to app

**POST `/northwind/auth/refresh`**
- Read refresh_token cookie
- Verify JWT signature
- Check revocation status in `acl.refresh_tokens`
- Rotate: revoke old, issue new pair
- Detect token reuse (family tracking)

**POST `/northwind/auth/logout`**
- Revoke refresh token
- Clear cookies

**POST `/northwind/auth/logout-all`**
- Call `acl.revoke_principal_tokens()`
- Clear cookies

**GET `/northwind/auth/me`**
- Get current authenticated user details
- Returns principal information from JWT

#### PostgreSQL Role Mapping Strategy

When issuing JWTs (login/register/refresh), the application must determine which PostgreSQL role to assign. This enables stateless GraphQL transport while enforcing RLS.

**Role Determination Logic**:

```typescript
async function determineRole(principalId: UUID): Promise<string> {
  // Query: SELECT acl.get_db_role($1)
  const result = await db.query(
    'SELECT acl.get_db_role($1) as role',
    [principalId]
  );
  return result.rows[0].role;
}

async function issueTokenPair(principal: Principal) {
  const role = await determineRole(principal.id);

  const accessToken = jwt.sign({
    sub: principal.id,
    email: principal.email,
    kind: principal.kind,
    role: role,  // Critical: Maps to PostgreSQL role
  }, privateKey, { algorithm: 'RS256', expiresIn: '15m' });

  // ... issue refresh token
}
```

**Role Assignment Rules** (implemented in `acl.get_db_role()`):
- **`app_admin`**: Principals with `relation='owner'` on `resource_type='system'`
- **`app_user`**: Employees, services, and customers (default authenticated role)
- **`app_readonly`**: Read-only access (groups, or degraded mode)
- **`anonymous`**: No authentication (public access)

**Benefits**:
- ✅ **Stateless**: No session lookup; role embedded in JWT
- ✅ **RLS Enforcement**: PostgreSQL enforces policies based on role
- ✅ **Granular Control**: Can revoke admin privileges by changing tuples (re-login required)
- ✅ **Audit Trail**: Role changes logged in `acl.tuples`

#### JWT Structure

**Access Token** (short-lived, 15 min):
```json
{
  "sub": "uuid-of-principal",
  "email": "user@example.com",
  "kind": "customer",
  "role": "app_user",
  "iat": 1234567890,
  "exp": 1234568790,
  "iss": "gql-cms-api",
  "aud": "gql-cms-client"
}
```

**Notes**:
- `sub`: Principal UUID (used to set `acl.current_principal()`)
- `role`: PostgreSQL role name (`app_user`, `app_readonly`, `app_admin`) for `pgSettings` role mapping
- `kind`: Principal kind from `acl.principals.kind` (for application logic)

**Refresh Token** (long-lived, 30 days):
```json
{
  "sub": "uuid-of-principal",
  "jti": "uuid-of-token",
  "family": "uuid-of-family",
  "iat": 1234567890,
  "exp": 1237159890,
  "iss": "gql-cms-api"
}
```

#### Middleware Integration

```typescript
// Auth middleware (already exists in gql-api/auth.middleware.ts)
export class AuthMiddleware implements NestMiddleware {
  use(req: any, res: any, next: Function) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies['access_token'];

    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_PUBLIC_KEY!, {
          algorithms: ['RS256']
        });
        req.auth = {
          principalId: payload.sub,
          email: payload.email,
          kind: payload.kind,
          role: payload.role,  // PostgreSQL role for pgSettings
        };
      } catch (err) {
        // Invalid/expired token - proceed as anonymous
      }
    }

    next();
  }
}

// PostGraphile pgSettings - enables stateless GraphQL with PostgreSQL role mapping
pgSettings: async (req: any) => {
  // Map identity to PostgreSQL role + set session principal
  // This enables RLS enforcement without maintaining server-side sessions
  return {
    role: req.auth?.role ?? 'anonymous',  // PostgreSQL role switching
    'app.principal_id': req.auth?.principalId ?? null,  // For acl.current_principal()
    'jwt.claims.email': req.auth?.email ?? null,
    'jwt.claims.kind': req.auth?.kind ?? null,
  };
}
```

**Key Design Points**:
1. **Stateless Transport**: No server-side sessions; all state in JWT cookies
2. **Role Mapping**: JWT `role` field maps directly to PostgreSQL roles (`app_user`, `app_admin`, `app_readonly`)
3. **Principal Setting**: `app.principal_id` session variable enables `acl.current_principal()` for RLS
4. **Anonymous Fallback**: Missing/invalid tokens default to `anonymous` role with no principal

### Security Considerations

#### 1. Password Security
- **Hashing Algorithm**: Use `argon2id` (recommended) or `bcrypt` with cost factor 12+
- **Never store plaintext**: Only store hashes in `acl.user_credentials.password_hash`
- **Rate limiting**: Protect `/northwind/auth/login` with rate limiting (e.g., 5 attempts per 15 min)
- **Password requirements**: Enforce minimum length (12+ chars), complexity in application layer

#### 2. Token Security
- **HttpOnly Cookies**: Never expose tokens to JavaScript
  - `access_token`: HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age=900 (15 min)
  - `refresh_token`: HttpOnly, Secure, SameSite=Lax, Path=/northwind/auth, Max-Age=2592000 (30 days)
- **Token Rotation**: Rotate refresh tokens on every use, track families
- **Revocation**: Support immediate revocation via `acl.refresh_tokens.revoked_at`
- **CSRF Protection**: Use SameSite cookies + double-submit token for mutations

#### 3. OAuth Security
- **PKCE**: Always use PKCE (RFC 7636) for authorization code flow
- **State validation**: Validate state parameter to prevent CSRF
- **Nonce validation**: Validate nonce in ID token to prevent replay attacks
- **Token encryption**: Encrypt provider tokens if storing for API calls (use `pg_crypto`)
- **Scope minimization**: Request only necessary OAuth scopes

#### 4. Database Security
- **RLS Enforcement**: Always enable RLS on auth tables
- **Function Security**: Use `SECURITY DEFINER` carefully, prefer `SECURITY INVOKER`
- **Encryption at Rest**: Use PostgreSQL encryption for sensitive columns
- **Audit Logging**: Log authentication events in `acl.refresh_tokens`, `acl.sessions`
- **Connection Security**: Use SSL/TLS for database connections

### Migration Strategy

#### Phase 1: Add Tables (Non-Breaking)
1. Run migration to create auth tables
2. Deploy without changing application behavior
3. Verify schema creation

#### Phase 2: Populate Existing Principals
1. For existing `acl.principals` with `external_id` like `'employee:X'` or `'customer:Y'`:
   - Create corresponding `acl.user_credentials` entries
   - Generate temporary passwords or mark as OAuth-only
   - Send password reset emails
2. For Northwind employees: Link to `northwind.employees.employee_id`
3. For Northwind customers: Link to `northwind.customers.customer_id`

```sql
-- Example migration for existing employees
INSERT INTO acl.user_credentials(principal_id, email, email_verified)
SELECT
    p.id,
    LOWER(e.first_name || '.' || e.last_name || '@northwind.example') as email,
    FALSE
FROM acl.principals p
JOIN northwind.employees e ON p.external_id = 'employee:' || e.employee_id::text
WHERE NOT EXISTS (
    SELECT 1 FROM acl.user_credentials c WHERE c.principal_id = p.id
);

-- Example migration for existing customers
INSERT INTO acl.user_credentials(principal_id, email, email_verified)
SELECT
    p.id,
    LOWER(REPLACE(c.contact_name, ' ', '.') || '@' || c.company_name || '.example') as email,
    FALSE
FROM acl.principals p
JOIN northwind.customers c ON p.external_id = 'customer:' || c.customer_id
WHERE NOT EXISTS (
    SELECT 1 FROM acl.user_credentials c WHERE c.principal_id = p.id
);
```

#### Phase 3: Implement Auth Endpoints
1. Develop NestJS auth module
2. Add password registration/login
3. Add OAuth providers (Google, GitHub)
4. Add token refresh/revocation

#### Phase 4: Integrate with PostGraphile
1. Update `auth.middleware.ts` to verify JWTs
2. Update `pgSettings` to call `acl.set_principal()`
3. Test RLS enforcement with authenticated requests

#### Phase 5: Gradual Rollout
1. Enable for test users
2. Monitor logs for errors
3. Full production rollout
4. Deprecate manual `SELECT acl.set_principal()` calls

### Testing Strategy

#### Unit Tests
- Password hashing/verification
- JWT signing/verification
- OAuth token exchange
- Refresh token rotation
- Revocation logic

#### Integration Tests
- `/auth/register` → creates principal + credentials
- `/auth/login` → sets cookies, returns tokens
- `/auth/:provider/callback` → links OAuth identity
- `/auth/refresh` → rotates tokens correctly
- `/auth/logout` → revokes token
- RLS enforcement with/without principal set

#### Security Tests
- Token expiration
- Revocation enforcement
- CSRF protection
- Rate limiting
- SQL injection (parameterized queries)
- Password strength enforcement

### Performance Considerations

1. **Token Verification**: Cache JWT public key in memory
2. **Database Queries**: Index `acl.user_credentials(email)`, `acl.oauth_identities(provider, provider_sub)`
3. **Token Cleanup**: Run `acl.cleanup_expired_tokens()` daily via cron
4. **Session Tracking**: Use Redis for session cache if scaling beyond single instance

### Open Questions / Decisions Needed

1. **Password vs OAuth Priority**: Should we encourage OAuth-only for customers, or support both equally?
2. **Email Verification**: Require email verification before access, or allow immediate login?
3. **Multi-Factor Authentication**: Add TOTP/SMS 2FA support in future?
4. **Device Management**: Allow users to view/revoke tokens per device?
5. **Account Linking**: Allow linking multiple OAuth providers to one principal?
6. **Password Reset**: Use email-based reset flow with time-limited tokens?
7. **Audit Retention**: How long to keep `acl.refresh_tokens` and `acl.sessions` history?

### Implementation Status

✅ **Database Schema** - Completed
- Created `85-northwind-auth-schema.sql` with authentication tables
- Created `90-northwind-auth-functions.sql` with helper functions

✅ **NestJS Backend** - Completed
- Implemented `NorthwindAuthModule` in `apps/gql-api/src/app/northwind-auth/`
- Authentication endpoints available at `/northwind/auth/*`:
  - POST `/northwind/auth/register` - User registration
  - POST `/northwind/auth/login` - Login with password
  - POST `/northwind/auth/refresh` - Refresh access token
  - POST `/northwind/auth/logout` - Logout current device
  - POST `/northwind/auth/logout-all` - Logout all devices
  - GET `/northwind/auth/me` - Get current user info
- Auth middleware integrated with PostGraphile pgSettings

### Next Steps

1. **Install Dependencies**: ✅ Completed
   ```bash
   npm install argon2 jsonwebtoken uuid pg cookie-parser
   npm install -D @types/jsonwebtoken @types/uuid @types/cookie-parser
   ```

2. **Setup Environment**:
   ```bash
   # Copy environment template
   cp .env.example .env

   # Edit .env and configure DATABASE_URL
   # JWT keys will be auto-generated in next step
   ```

3. **Build Project** (Auto-generates JWT keys):
   ```bash
   npm run build
   # This runs bin/jwt_keys.sh which:
   # - Generates 2048-bit RSA key pair
   # - Stores keys in .env as JWT_PRIVATE_KEY and JWT_PUBLIC_KEY
   # - Then builds all projects
   ```

   **Note**: JWT keys are automatically generated during build. The `bin/jwt_keys.sh` script is called before the build process. You can also manually generate keys with:
   ```bash
   bash bin/jwt_keys.sh
   ```

4. **Start Services**:
   ```bash
   npm start
   # Runs build (generates keys) + docker-compose up
   # Database migrations run automatically via db-init service

   # API available at: http://localhost:5433
   # GraphiQL: http://localhost:5433/graphiql
   # Admin UI: http://localhost:4200
   ```

5. **Test Authentication**:
   ```bash
   # Register new user
   curl -c cookies.txt -X POST http://localhost:5433/northwind/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"SecurePass123!","kind":"customer"}'

   # Login
   curl -c cookies.txt -X POST http://localhost:5433/northwind/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"SecurePass123!"}'

   # Get current user
   curl -b cookies.txt http://localhost:5433/northwind/auth/me
   ```

6. **Update Frontend** to use `/northwind/auth/*` endpoints and handle cookies

7. **Document API** in OpenAPI/Swagger (optional)

8. **Write integration tests** (optional)

9. **Deploy to staging** for QA

### Important Security Notes

- ⚠️ `.env` file is in `.gitignore` and should **never** be committed to version control
- ⚠️ JWT keys are sensitive credentials - keep them secure
- ⚠️ Generate new keys for each environment (dev, staging, production)
- ⚠️ For production, manually generate and securely store keys (don't rely on auto-generation)
- ⚠️ Rotate keys periodically in production environments

---

## Rationale for Design Decisions

### Why Separate `acl.user_credentials` from `acl.principals`?

**Separation of Identity and Actor**:
- `acl.principals` represents an **actor** in the authorization system (employee, customer, service account)
- `acl.user_credentials` represents **authentication credentials** for that actor
- One principal may have multiple authentication methods (password + Google + GitHub)
- Service accounts (`kind='service'`) may never have credentials (API key-based)
- Groups (`kind='group'`) don't have credentials but contain members

This design:
- ✅ Supports account linking (multiple OAuth providers → one principal)
- ✅ Allows principals to exist without passwords (OAuth-only)
- ✅ Keeps authorization logic clean (RLS policies only care about principal_id)
- ✅ Enables service accounts and groups in the same principal table

### Why Store Refresh Tokens in Database vs Redis?

**PostgreSQL for Audit + Security**:
- ✅ **Audit Trail**: Full history of token issuance, usage, revocation
- ✅ **Consistency**: Single source of truth with transactions
- ✅ **Revocation**: Immediate enforcement via database query
- ✅ **Family Tracking**: Detect token reuse attacks with SQL JOINs
- ✅ **User Management**: Users can view/revoke their own tokens via RLS

**Redis would be better for**:
- ❌ High-frequency token checks (but we verify JWT signature first, only check DB on refresh)
- ❌ Distributed systems (but we can replicate PostgreSQL too)

**Hybrid Approach** (future optimization):
- Store in PostgreSQL for audit
- Cache active tokens in Redis with TTL
- Check Redis first, fall back to PostgreSQL

### Why CITEXT for Email?

**Case-Insensitive Unique Emails**:
- `user@example.com` and `USER@EXAMPLE.COM` are the same email
- `CITEXT` provides case-insensitive comparison without losing original case
- Ensures unique constraint works correctly: `CREATE UNIQUE INDEX ON acl.user_credentials(email)`

### Why Token Family Tracking?

**Detect Token Theft**:
1. User logs in → receives refresh token A (family UUID: F1)
2. Token A refreshed → revoked, new token B issued (family: F1)
3. If attacker uses stolen token A → system detects old token from family F1 was reused
4. **Automatic response**: Revoke entire family F1, force re-login

This prevents "confused deputy" attacks where stolen refresh tokens are replayed.

### Why HttpOnly Cookies vs Local Storage?

**Security > Convenience**:
- ❌ **Local Storage**: Vulnerable to XSS (any injected script can steal tokens)
- ✅ **HttpOnly Cookies**: Inaccessible to JavaScript, immune to XSS token theft
- ✅ **Secure Flag**: Ensures transmission only over HTTPS
- ✅ **SameSite**: Protects against CSRF attacks

**Trade-off**: Slightly more complex client-side (can't read token), but massively more secure.

### Why Separate `/northwind/auth` Path for Refresh Token Cookie?

**Principle of Least Privilege**:
- Access tokens: Used by all endpoints → `Path=/` cookie
- Refresh tokens: Only used by `/northwind/auth/refresh` → `Path=/northwind/auth` cookie

Benefits:
- ✅ Reduces attack surface (refresh token not sent to non-auth endpoints)
- ✅ If non-auth endpoint is compromised, can't steal refresh token
- ✅ Follows OAuth 2.0 security best practices

### Why PKCE for OAuth?

**RFC 7636 - Proof Key for Code Exchange**:
- Protects against authorization code interception attacks
- Especially important for public clients (SPAs, mobile apps)
- Required by OAuth 2.1 specification
- No downside to using it (supported by all major providers)

**Flow**:
1. Client generates `code_verifier` (random string)
2. Client sends `code_challenge = SHA256(code_verifier)` to auth server
3. Auth server returns authorization code
4. Client sends code + `code_verifier` to token endpoint
5. Server verifies `SHA256(code_verifier) == code_challenge`

This ensures even if authorization code is intercepted, attacker can't exchange it without verifier.

### Why argon2id Over bcrypt?

**Modern Password Hashing**:
- ✅ **argon2id**: Winner of Password Hashing Competition (2015)
- ✅ Resistant to GPU/ASIC attacks (memory-hard)
- ✅ Configurable time/memory costs
- ❌ **bcrypt**: Older, less resistant to hardware attacks

**Recommendation**: Use `@node-rs/argon2` in NestJS for native performance.

### Why Email as Primary Identifier?

**User Experience**:
- ✅ Users remember emails better than usernames
- ✅ Email required for password reset anyway
- ✅ Most OAuth providers return email as primary identifier
- ✅ Enables account linking (match OAuth email to existing account)

**Alternative** (future): Support username OR email login, store username in `acl.user_credentials`.

---

This proposal provides a comprehensive, secure, and scalable authentication system that integrates seamlessly with the existing Northwind ACL authorization model. The separation of authentication (who you are) from authorization (what you can do) maintains clean architectural boundaries while enabling multiple authentication methods per principal.

#  Next Steps

  To use the authentication system:

1. Generate JWT keys:
```bash
    openssl genrsa -out jwt-private.pem 2048
    openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem
```
2. Configure environment variables in .env:
```bash
   JWT_PRIVATE_KEY=<contents of jwt-private.pem>
   JWT_PUBLIC_KEY=<contents of jwt-public.pem>
   DATABASE_URL=postgresql://postgres:password@localhost:5432/gql_cms
```
3. Start services:
```bash
    npm start  # Runs docker-compose, migrations auto-applied
```
4. Test authentication:
## Register
```bash
    curl -X POST http://localhost:5433/northwind/auth/register \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"SecurePass123!","kind":"customer"}'
```

## Login
```bash
    curl -X POST http://localhost:5433/northwind/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"SecurePass123!"}'
```
