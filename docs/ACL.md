# Web Authentication & Authorization Stack

**Stack**: Web (Apollo Client) → NestJS (Auth endpoints + PostGraphile middleware) → PostgreSQL (RLS as source of truth)

---

## IMPORTANT: Two ACL Systems in This Project

This project demonstrates **TWO different authorization approaches**:

### System 1: `gql_cms` Schema - Simple Per-Resource ACL
- **Status:** ⚠️ **PARTIAL** - Schema and RLS implemented, **AUTH NOT IMPLEMENTED**
- **Location:** `apps/db-init/db/init/20-gql-cms-schema.sql`, `26-gql-cms-acl.sql`
- **Tables:** `gql_cms.users`, `gql_cms.documents`, `gql_cms.user_roles`, `gql_cms.document_acl`
- **Auth:** None (you must implement using patterns below)
- **Use Case:** Simple CMS, learning projects, custom auth requirements

### System 2: `acl` Schema - Zanzibar-style ReBAC ✅ **FULLY IMPLEMENTED**
- **Status:** ✅ **PRODUCTION-READY** with complete authentication
- **Location:** `apps/db-init/db/init/70-northwind-acl-schema.sql`, `85-northwind-auth-schema.sql`, `90-northwind-auth-functions.sql`
- **Code:** `apps/gql-api/src/app/northwind-auth/`
- **Tables:** `acl.principals`, `acl.tuples`, `acl.objects`, `acl.user_credentials`, `acl.refresh_tokens`
- **Auth:** ✅ **Working at `/northwind/auth/*` endpoints**
- **Tests:** ✅ Complete E2E test coverage (`apps/gql-api-e2e/src/gql-api/northwind-auth.spec.ts`)
- **Use Case:** Production systems, multi-tenant apps, complex permissions

**📘 This document primarily describes System 1 (`gql_cms`) patterns. For working authentication, 
see [System 2 Implementation](#system-2-northwind-zanzibar-implementation-working) at the end.**

---

## 0) Goals

* Keep **authorization in Postgres** via Row‑Level Security (RLS).
* Use **cookies** (HttpOnly) so tokens never live in JavaScript.
* Support both **password** auth and **3rd‑party OAuth/OIDC**.
* Make GraphQL transport **stateless** (except for cookies) and let **pgSettings** carry identity → Postgres role mapping.

---

## 1) High‑Level Architecture

### System 1: `gql_cms` Schema (Theoretical - Auth Not Implemented)

```
[Browser: Apollo Client]
   | HTTP(S) + cookies (SameSite)
   v
[NestJS]
  ├─ /gql_cms/auth/* endpoints (⚠️ NOT IMPLEMENTED)
  └─ /gql_cms/graphql (PostGraphile mounted on 'gql_cms' schema)
   |
   v
[PostgreSQL]
  ├─ Schema: gql_cms
  ├─ Tables: users, documents, user_roles, document_acl, user_acl
  ├─ Helper functions: has_global_role(), has_doc_role(), current_user_id()
  └─ RLS policies read current_setting('gql_cms.user_id')
```

### System 2: `acl` Schema (Actual Implementation - Working)

```
[Browser: Apollo Client]
   | HTTP(S) + cookies (HttpOnly, SameSite=Lax)
   v
[NestJS]
  ├─ /northwind/auth/register | /login | /refresh | /logout | /me
  ├─ AuthMiddleware verifies JWT from cookies → sets req.auth
  └─ /graphql (PostGraphile on 'gql_cms'; pgSettings sets app.principal_id)
   |
   v
[PostgreSQL]
  ├─ Schema: acl (Zanzibar tuples)
  ├─ Tables: principals, tuples, objects, user_credentials, oauth_identities, refresh_tokens
  ├─ Functions: has_permission(), current_principal(), create_principal_with_password()
  └─ RLS policies read current_setting('app.principal_id')
```

**Key concept**: NestJS verifies cookies → attaches `req.auth` → PostGraphile `pgSettings` sets session variables per request → RLS policies enforce access.

---

## 2) Client (Apollo) Setup

```ts
import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';

// For gql_cms schema (when auth implemented)
const httpLink = new HttpLink({ uri: '/gql_cms/graphql', credentials: 'include' });

// OR for working Northwind system
// const httpLink = new HttpLink({ uri: '/graphql', credentials: 'include' });

export const client = new ApolloClient({
  link: ApolloLink.from([httpLink]),
  cache: new InMemoryCache(),
});
```

**Notes**

* Use **same‑origin** where possible.
* For mutations, add **double‑submit CSRF** header (e.g., `X-CSRF-Token`).
* Subscriptions: use `graphql-ws`; cookies flow to WSS on same site.
* **Endpoint naming**: `/gql_cms/graphql` for gql_cms schema, `/graphql` for current implementation (currently serves gql_cms but not namespaced)

---

## 3) NestJS: PostGraphile + Auth Middleware

**Actual Implementation** (`apps/gql-api/src/app/app.module.ts`):

```ts
// app.module.ts
import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { postgraphile } from 'postgraphile';
import { AuthMiddleware } from './auth.middleware';
import { NorthwindAuthModule } from './northwind-auth/auth.module';

@Module({
  imports: [NorthwindAuthModule],
  // ...
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply auth middleware to all routes
    consumer
      .apply(AuthMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    // PostGraphile configured for 'gql_cms' schema
    // ⚠️ NOTE: Currently mounted at /graphql, should be /gql_cms/graphql for proper namespacing
    consumer
      .apply(
        postgraphile(process.env.DATABASE_URL, 'gql_cms', {
          graphiql: process.env.NODE_ENV !== 'production',
          enhanceGraphiql: process.env.NODE_ENV !== 'production',
          retryOnInitFail: true,
          // Set per-request PostgreSQL session variables
          pgSettings: async (req) => {
            const auth = req.auth ?? { role: 'anonymous' };

            return {
              role: auth.role,                         // Application role name (not SET ROLE)
              'app.principal_id': auth.userId ?? null, // For acl.current_principal()
              'gql_cms.user_id': auth.userId ?? null,  // For gql_cms.current_user_id() (not used)
              'jwt.claims.user_id': auth.userId ?? null,
              'jwt.claims.email': auth.email ?? null,
              'jwt.claims.scopes': (auth.scopes ?? []).join(','),
            };
          },
        })
      )
      .forRoutes('/graphql'); // TODO: Change to '/gql_cms/graphql' for proper namespacing
  }
}
```

**Note**: Session variables are set but `gql_cms.user_id` is not used since `gql_cms` schema has no auth. The working auth uses `app.principal_id` for the `acl` schema.

**TODO**: Update route from `/graphql` to `/gql_cms/graphql` to properly namespace the endpoint and distinguish it from potential future endpoints for other schemas.

### Auth middleware (verify access cookie → req.auth)

```ts
// auth.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import * as cookie from 'cookie';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: any, res: any, next: Function) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies['access_token'];
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_PUBLIC_KEY!, { algorithms: ['RS256'] }) as any;
        req.auth = {
          role: payload.role ?? 'app_user',
          userId: payload.sub,
          email: payload.email,
          scopes: payload.scopes ?? [],
        };
      } catch {}
    }
    next();
  }
}
```

---

## 4) Auth Endpoints (Password + OAuth)

⚠️ **IMPLEMENTATION STATUS**: The patterns below describe how to implement auth for `gql_cms` schema, but are **NOT CURRENTLY IMPLEMENTED** for `gql_cms`. For a **working reference implementation**, see [System 2: Northwind Auth](#system-2-northwind-zanzibar-implementation-working) below, which includes:
- `apps/gql-api/src/app/northwind-auth/auth.service.ts` - Complete auth service with argon2, JWT, and token rotation
- `apps/gql-api/src/app/northwind-auth/auth.controller.ts` - REST endpoints
- `apps/db-init/db/init/90-northwind-auth-functions.sql` - Database functions
- `apps/gql-api-e2e/src/gql-api/northwind-auth.spec.ts` - E2E tests proving it works

### 4.1 Cookies helper & refresh rotation

```ts
// sessions.service.ts (essentials)
setAuthCookies(res, { accessJwt, refreshJwt }) {
  res.cookie('access_token', accessJwt, {
    httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 15 * 60 * 1000,
  });
  res.cookie('refresh_token', refreshJwt, {
    httpOnly: true, secure: true, sameSite: 'Lax', path: '/auth', maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}
clearAuthCookies(res) {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/auth' });
}
```

### 4.2 Password login (argon2)

```ts
// Theoretical endpoint: POST /gql_cms/auth/login
@Post('login')
async login(@Body() dto: { email: string; password: string }, @Res() res) {
  const user = await this.users.findByEmail(dto.email);
  if (!user) throw new UnauthorizedException();
  const ok = await argon2.verify(user.password_hash, dto.password);
  if (!ok) throw new UnauthorizedException();
  const role = await this.sessions.resolveRoleForUser(user);
  const { accessJwt, refreshJwt } = await this.sessions.issueTokenPair(user.id, role, req);
  this.sessions.setAuthCookies(res, { accessJwt, refreshJwt });
  res.status(204).end();
}
```

### 4.3 OAuth/OIDC start + callback (PKCE)

```ts
// Theoretical endpoints: GET /gql_cms/auth/:provider/start and /gql_cms/auth/:provider/callback
@Get(':provider/start')  // e.g., google, github
async start(@Param('provider') provider: string, @Req() req, @Res() res) {
  const { url } = await this.oauth.begin(provider, req, res); // stores state/nonce/pkce
  return res.redirect(url);
}

@Get(':provider/callback')
async cb(@Param('provider') provider: string, @Req() req, @Res() res) {
  const { userId, role } = await this.oauth.complete(provider, req, res); // exchange code, link/create user
  const { accessJwt, refreshJwt } = await this.sessions.issueTokenPair(userId, role, req);
  this.sessions.setAuthCookies(res, { accessJwt, refreshJwt });
  return res.redirect(process.env.POST_LOGIN_REDIRECT ?? '/');
}
```

### 4.4 Refresh & logout

```ts
// Theoretical endpoints: GET /gql_cms/auth/refresh and POST /gql_cms/auth/logout
@Get('refresh')
async refresh(@Req() req, @Res() res) {
  const { accessJwt, refreshJwt } = await this.sessions.rotate(req);
  this.sessions.setAuthCookies(res, { accessJwt, refreshJwt });
  res.status(204).end();
}

@Post('logout')
async logout(@Req() req, @Res() res) {
  await this.sessions.revokeFromRequest(req);
  this.clearAuthCookies(res);
  res.status(204).end();
}
```

---

## 5) PostgreSQL Schema & RLS

### 5.1 Ownership Modeling

**IMPORTANT CLARIFICATION**: The "roles" discussed here are **application-level role names stored in tables**, NOT PostgreSQL database roles created with `CREATE ROLE`.

**What Actually Happens**:
1. PostGraphile's `pgSettings` sets `role` as a **configuration variable**: `SET LOCAL role = 'admin'`
2. This is a **string variable**, NOT a role switch (no `SET ROLE` or `SET SESSION AUTHORIZATION`)
3. RLS policies read this via: `current_setting('role', true)`
4. The application connects to PostgreSQL as a single database user (connection pooling)

**Actual Implementation** (`apps/db-init/db/init/20-gql-cms-schema.sql:76-83`):
```sql
-- Role names are stored as data in a table
CREATE TABLE gql_cms.roles (
  name text PRIMARY KEY,
  description text
);

INSERT INTO gql_cms.roles(name, description) VALUES
  ('admin','full admin'),
  ('manager','global manager'),
  ('bot','read-only bot'),
  ('authorizer','can only create users'),
  ('owner','per-record owner');
```

* **Do not** create PostgreSQL roles (`CREATE ROLE owner`). Ownership is represented as **ACL data**.
* Keep role names simple (`admin`, `manager`, `bot`), stored in tables, and model ownership per resource.

#### 5.1.a Per‑Resource ACLs (recommended)

```sql
CREATE TYPE gql_cms.doc_role AS ENUM ('owner','manager','viewer');
CREATE TABLE gql_cms.document_acl (
  document_id uuid REFERENCES gql_cms.documents(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES gql_cms.users(id) ON DELETE CASCADE,
  role        gql_cms.doc_role NOT NULL,
  PRIMARY KEY (document_id, user_id)
);

CREATE TYPE gql_cms.user_role AS ENUM ('owner','manager','viewer');
CREATE TABLE gql_cms.user_acl (
  subject_user_id uuid NOT NULL,  -- who has the permission (e.g., manager)
  object_user_id  uuid NOT NULL,  -- which user record is governed (e.g., employee)
  role            gql_cms.user_role NOT NULL,
  PRIMARY KEY(subject_user_id, object_user_id)
);

CREATE FUNCTION gql_cms.has_doc_role(doc_id uuid, want gql_cms.doc_role[])
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM gql_cms.document_acl a
    WHERE a.document_id = doc_id
      AND a.user_id = gql_cms.current_user_id()
      AND a.role = ANY(want)
  );
$$;

CREATE FUNCTION gql_cms.has_user_role(u_id uuid, want gql_cms.user_role[])
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM gql_cms.user_acl a
    WHERE a.object_user_id = u_id
      AND a.subject_user_id = gql_cms.current_user_id()
      AND a.role = ANY(want)
  );
$$;
```

**RLS examples**

```sql
ALTER TABLE gql_cms.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE gql_cms.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE gql_cms.document_acl ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION gql_cms.current_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('jwt.claims.user_id', true), '')::uuid
$$;

-- users policies (self or managed)
CREATE POLICY users_select
  ON gql_cms.users FOR SELECT
  USING (
    id = gql_cms.current_user_id()
    OR gql_cms.has_user_role(id, ARRAY['owner','manager']::gql_cms.user_role[])
    OR current_setting('role', true) IN ('admin')
  );

CREATE POLICY users_update
  ON gql_cms.users FOR UPDATE
  USING (
    id = gql_cms.current_user_id()
    OR gql_cms.has_user_role(id, ARRAY['owner','manager']::gql_cms.user_role[])
    OR current_setting('role', true) IN ('admin')
  )
  WITH CHECK (
    id = gql_cms.current_user_id()
    OR gql_cms.has_user_role(id, ARRAY['owner','manager']::gql_cms.user_role[])
    OR current_setting('role', true) IN ('admin')
  );

-- documents policies (owner/manager write, viewer read)
CREATE POLICY documents_read ON gql_cms.documents FOR SELECT
USING (
  gql_cms.has_doc_role(id, ARRAY['owner','manager','viewer']::gql_cms.doc_role[])
  OR current_setting('role', true) IN ('bot','manager','admin')
);

CREATE POLICY documents_write ON gql_cms.documents FOR UPDATE, DELETE
USING (
  gql_cms.has_doc_role(id, ARRAY['owner','manager']::gql_cms.doc_role[])
  OR current_setting('role', true) IN ('manager','admin')
)
WITH CHECK (
  gql_cms.has_doc_role(id, ARRAY['owner','manager']::gql_cms.doc_role[])
  OR current_setting('role', true) IN ('manager','admin')
);

-- creator becomes owner (trigger)
CREATE FUNCTION gql_cms.document_after_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO gql_cms.document_acl(document_id, user_id, role)
  VALUES (NEW.id, gql_cms.current_user_id(), 'owner'::gql_cms.doc_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER _document_owner AFTER INSERT ON gql_cms.documents
FOR EACH ROW EXECUTE FUNCTION gql_cms.document_after_insert();
```

#### 5.1.b Generic ReBAC Table (Zanzibar‑style)

```sql
CREATE TYPE gql_cms.rel AS ENUM ('owner','manager','viewer');
CREATE TABLE gql_cms.relation_edge (
  subject_type text NOT NULL,  -- 'user'
  subject_id   uuid NOT NULL,
  relation     gql_cms.rel NOT NULL,   -- 'owner' | 'manager' | 'viewer'
  object_type  text NOT NULL,  -- 'document' | 'user'
  object_id    uuid NOT NULL,
  PRIMARY KEY(subject_type, subject_id, relation, object_type, object_id)
);

CREATE FUNCTION gql_cms.has_relation(obj_type text, obj_id uuid, want gql_cms.rel[])
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM gql_cms.relation_edge e
    WHERE e.subject_type = 'user'
      AND e.subject_id = gql_cms.current_user_id()
      AND e.object_type = obj_type
      AND e.object_id = obj_id
      AND e.relation = ANY(want)
  );
$$;
```

**Choose** per‑table ACLs for simple projects, or `relation_edge` for scalable multi‑entity ReBAC authorization.

### 5.2 Core Tables

**Actual `gql_cms` Schema** (`apps/db-init/db/init/20-gql-cms-schema.sql`):

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive text

-- Users table (NO password field - auth not implemented)
CREATE TABLE gql_cms.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE,
  auth_provider text NOT NULL,  -- Placeholder: 'password', 'google', etc.
  full_name     text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Documents table (NO owner_id - ownership tracked via ACL table)
CREATE TABLE gql_cms.documents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_url   text NOT NULL,
  short_url  text NOT NULL UNIQUE,
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ⚠️ Auth tables NOT PRESENT in gql_cms schema
-- To add authentication to gql_cms, you would need to create:

-- ALTER TABLE gql_cms.users ADD COLUMN password_hash text;

-- CREATE TABLE gql_cms.oauth_identities (
--   id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id      uuid NOT NULL REFERENCES gql_cms.users(id) ON DELETE CASCADE,
--   provider     text NOT NULL,
--   provider_sub text NOT NULL,
--   email        citext,
--   profile_data jsonb DEFAULT '{}'::jsonb,
--   created_at   timestamptz NOT NULL DEFAULT now(),
--   UNIQUE (provider, provider_sub)
-- );

-- CREATE TABLE gql_cms.refresh_tokens (
--   jti        uuid PRIMARY KEY,
--   user_id    uuid NOT NULL REFERENCES gql_cms.users(id) ON DELETE CASCADE,
--   token_family uuid NOT NULL,
--   issued_at  timestamptz NOT NULL DEFAULT now(),
--   expires_at timestamptz NOT NULL,
--   revoked_at timestamptz,
--   revoked_reason text,
--   user_agent text,
--   ip_address inet
-- );
```

**Reference: Working Auth Tables in `acl` Schema** (`apps/db-init/db/init/85-northwind-auth-schema.sql`):

```sql
-- These tables exist and are fully functional in the acl schema
CREATE TABLE acl.user_credentials (
  principal_id    uuid PRIMARY KEY REFERENCES acl.principals(id),
  email           citext UNIQUE NOT NULL,
  password_hash   text,  -- argon2id hash
  email_verified  boolean DEFAULT FALSE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE acl.oauth_identities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id    uuid NOT NULL REFERENCES acl.principals(id),
  provider        text NOT NULL,
  provider_sub    text NOT NULL,
  provider_email  citext,
  profile_data    jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_sub)
);

CREATE TABLE acl.refresh_tokens (
  jti             uuid PRIMARY KEY,
  principal_id    uuid NOT NULL REFERENCES acl.principals(id),
  token_family    uuid NOT NULL,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  revoked_reason  text,
  user_agent      text,
  ip_address      inet,
  last_used_at    timestamptz
);
```

### 5.3 Role Names (Application-Level, NOT PostgreSQL Roles)

⚠️ **IMPORTANT**: The implementation does **NOT** create PostgreSQL database roles. Role names are stored as **data in tables** and read as **configuration variables**.

**What the documentation calls "roles" are actually:**
1. Role names in the `gql_cms.roles` table (for `gql_cms` schema)
2. Principal kinds in `acl.principals.kind` enum (for `acl` schema)
3. Session variable `role` set by `pgSettings` (just a string, not a role switch)

**No `CREATE ROLE` statements exist** in the actual implementation.

**Connection User**: The application connects as `postgres` (or a single connection pool user), and RLS policies use session variables to determine access, not role switching.

---

## 6) OAuth Service (Nest, using `openid-client`)

```ts
// oauth.service.ts
import { Issuer, generators } from 'openid-client';

export class OAuthService {
  private clients = new Map<string, any>();

  async client(provider: string) {
    if (this.clients.has(provider)) return this.clients.get(provider);
    const issuer = await Issuer.discover(process.env[`OIDC_${provider.toUpperCase()}_ISSUER`]!);
    const client = new issuer.Client({
      client_id: process.env[`OIDC_${provider.toUpperCase()}_CLIENT_ID`]!,
      client_secret: process.env[`OIDC_${provider.toUpperCase()}_CLIENT_SECRET`]!,
      redirect_uris: [process.env[`OIDC_${provider.toUpperCase()}_REDIRECT`]!],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
    });
    this.clients.set(provider, client);
    return client;
  }

  newPkce() {
    const code_verifier = generators.codeVerifier();
    return {
      state: generators.state(),
      nonce: generators.nonce(),
      code_verifier,
      code_challenge: generators.codeChallenge(code_verifier),
    };
  }
}
```

**Flow**

1. `/gql_cms/auth/:provider/start` → build authorization URL with PKCE, save `{state, nonce, code_verifier}`.
2. `/gql_cms/auth/:provider/callback` → exchange `code`, link/create user, mint app cookies.

---

## 7) Token Pair Issuance & Rotation

```ts
// sessions.service.ts
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { addDays } from 'date-fns';

async issueTokenPair(userId: string, role: string, req: any) {
  const accessJwt = jwt.sign(
    { sub: userId, role, scopes: [] },
    process.env.JWT_PRIVATE_KEY!,
    { algorithm: 'RS256', expiresIn: '15m' }
  );
  const jti = randomUUID();
  await this.refreshRepo.insert({ jti, userId, expiresAt: addDays(new Date(), 30), ua: req.headers['user-agent'], ip: req.ip });
  const refreshJwt = jwt.sign(
    { sub: userId, jti },
    process.env.JWT_PRIVATE_KEY!,
    { algorithm: 'RS256', expiresIn: '30d' }
  );
  return { accessJwt, refreshJwt };
}

async rotate(req: any) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies['refresh_token'];
  const payload = jwt.verify(token, process.env.JWT_PUBLIC_KEY!, { algorithms: ['RS256'] }) as any;
  await this.refreshRepo.revoke(payload.jti);
  const role = await this.resolveRoleForUserId(payload.sub);
  return this.issueTokenPair(payload.sub, role, req);
}
```

---

## 8) CSRF Strategy

* **SameSite=Lax** cookies + **double‑submit** token (`csrf_token` cookie + `X-CSRF-Token` header for mutations).
* For GraphiQL in dev, auto‑inject the header.

---

## 9) GraphQL Security Conventions

* Restrict introspection in production (optional).
* Use persisted queries or depth/complexity limits.
* Prefer **SQL functions** exposed by PostGraphile for complex, permissioned actions (RLS still applies).

---

## 10) Environment Variables (minimal)

```
DATABASE_URL=postgres://api:***@localhost:5432/app
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY----- ...
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY----- ...
POST_LOGIN_REDIRECT=/

# OAuth providers (examples)
OIDC_GOOGLE_ISSUER=https://accounts.google.com
OIDC_GOOGLE_CLIENT_ID=...
OIDC_GOOGLE_CLIENT_SECRET=...
OIDC_GOOGLE_REDIRECT=https://app.example.com/auth/google/callback
```

---

## 11) Nx Workspace Sketch

```
apps/
  web/                 # Next/React SPA using Apollo Client
  api/                 # NestJS app (auth + PostGraphile)
libs/
  db-schema/           # SQL migrations & helpers
  auth-shared/         # DTOs, types, role constants
```

---

## 12) Testing Plan

* **Unit**: token issuing/rotation, CSRF, guards.
* **Integration**: supertest → `/auth/login`, `/auth/:provider/*`, `/graphql` with cookies.
* **DB**: migrate + seed; psql tests: `SET LOCAL ROLE app_user`; set `jwt.claims.user_id`; verify RLS visibility.
* **E2E**: Playwright: login flow (popup/redirect), mutation blocked without CSRF, allowed with CSRF.

---

## 13) Hardening Checklist

* HTTPS everywhere; HSTS.
* Cookie flags: `HttpOnly`, `Secure`, `SameSite=Lax|Strict`.
* Rate limit `/auth/*`.
* Device/session management UI (list & revoke refresh JTIs).
* Encrypt provider refresh tokens at rest (if stored).
* Avoid `BYPASSRLS` roles; keep `api` minimal.
* Index `document_acl(document_id, user_id)` and any fields used by RLS.

---

## 14) Common Scenarios

* **Share document**: expose `share_document(doc_id, user_id, role)` SQL function; policy ensures only owner/manager can share.
* **Bot account**: service integration logs in via service secret; server sets `role=bot`; RLS allows read‑all only.
* **Admin/Manager**: maintain allowlist in `user_role(user_id, role)` or map by email domain; resolved each request.

---

## 15) Minimal SQL for “share” mutation (exposed by PostGraphile)

```sql
CREATE FUNCTION gql_cms.share_document(p_document_id uuid, p_user_id uuid, p_role gql_cms.doc_role)
RETURNS boolean LANGUAGE sql VOLATILE AS $$
  INSERT INTO gql_cms.document_acl(document_id, user_id, role)
  SELECT d.id, p_user_id, p_role
  FROM gql_cms.documents d
  WHERE d.id = p_document_id
    AND (gql_cms.has_doc_role(d.id, ARRAY['owner','manager']::gql_cms.doc_role[])
         OR current_setting('role', true) IN ('manager','admin'));
  SELECT FOUND;
$$;
```

---

## 16) Curl Smoke Tests (Theoretical - gql_cms Schema)

```bash
# 1) login (password) - NOT IMPLEMENTED
curl -i -X POST http://localhost:5433/gql_cms/auth/login \
  -d '{"email":"a@b.com","password":"secret"}' \
  -H 'Content-Type: application/json'

# 2) query with cookies - NOT IMPLEMENTED
curl -i http://localhost:5433/gql_cms/graphql \
  -H 'Content-Type: application/json' \
  -H 'X-CSRF-Token: <value from cookie>' \
  --data '{"query":"{ currentUser { id email } }"}' \
  --cookie 'access_token=...; csrf_token=...'

# 3) refresh - NOT IMPLEMENTED
curl -i http://localhost:5433/gql_cms/auth/refresh --cookie 'refresh_token=...'
```

**Note**: For working examples, see [System 2: Northwind Auth](#system-2-northwind-zanzibar-implementation-working) below, which uses `/northwind/auth/*` endpoints.

---

## 17) Open Questions / TODOs (for gql_cms Schema)

* Implement auth endpoints for `gql_cms` schema (see working reference in System 2 below)
* Add password_hash column to `gql_cms.users`
* Create OAuth and refresh token tables for `gql_cms` schema
* Decide: Keep both systems or migrate to Zanzibar (`acl` schema)
* Add CSRF protection for GraphQL mutations

---

## System 2: Northwind Zanzibar Implementation (WORKING)

### Implementation Status

✅ **PRODUCTION-READY** - Fully implemented and tested authentication system

| Component | Status | Location |
|-----------|--------|----------|
| Auth Controller | ✅ Complete | `apps/gql-api/src/app/northwind-auth/auth.controller.ts:9-251` |
| Auth Service | ✅ Complete | `apps/gql-api/src/app/northwind-auth/auth.service.ts:11-341` |
| Database Schema | ✅ Complete | `apps/db-init/db/init/85-northwind-auth-schema.sql` |
| Helper Functions | ✅ Complete | `apps/db-init/db/init/90-northwind-auth-functions.sql` |
| E2E Tests | ✅ Complete | `apps/gql-api-e2e/src/gql-api/northwind-auth.spec.ts` |
| Password Hashing | ✅ argon2id | `auth.service.ts:36-42` |
| JWT Algorithm | ✅ RS256 | `auth.service.ts:136-152` |
| Token Rotation | ✅ Complete | `auth.service.ts:172-260` |
| Cookie Security | ✅ Complete | `auth.controller.ts:224-242` |

---

### API Endpoints

All endpoints are at `/northwind/auth` and fully functional:

#### POST /northwind/auth/register
Register new user with password authentication.

**Request:**
```bash
curl -X POST http://localhost:5433/northwind/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "kind": "customer",
    "displayName": "John Doe"
  }'
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "principal": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "kind": "customer",
    "displayName": "John Doe",
    "emailVerified": false
  }
}
```

**Cookies Set:**
- `access_token` (HttpOnly, SameSite=Lax, Path=/, 15 min)
- `refresh_token` (HttpOnly, SameSite=Lax, Path=/northwind/auth, 30 days)

---

#### POST /northwind/auth/login
Authenticate with email and password.

**Request:**
```bash
curl -X POST http://localhost:5433/northwind/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }' \
  -c cookies.txt
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "principal": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "kind": "customer",
    "displayName": "John Doe",
    "emailVerified": false
  }
}
```

---

#### GET /northwind/auth/me
Get current authenticated user details.

**Request:**
```bash
curl http://localhost:5433/northwind/auth/me \
  -b cookies.txt
```

**Response (200):**
```json
{
  "success": true,
  "principal": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "kind": "customer",
    "displayName": "John Doe",
    "emailVerified": false,
    "role": "app_user"
  }
}
```

---

#### POST /northwind/auth/refresh
Rotate refresh token and issue new access token.

**Request:**
```bash
curl -X POST http://localhost:5433/northwind/auth/refresh \
  -b cookies.txt \
  -c cookies.txt
```

**Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed"
}
```

**Token Rotation**: Old refresh token is revoked, new access + refresh tokens issued.

---

#### POST /northwind/auth/logout
Logout current device (revoke refresh token).

**Request:**
```bash
curl -X POST http://localhost:5433/northwind/auth/logout \
  -b cookies.txt
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

#### POST /northwind/auth/logout-all
Logout all devices (revoke all tokens for user).

**Request:**
```bash
curl -X POST http://localhost:5433/northwind/auth/logout-all \
  -b cookies.txt
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out from all devices"
}
```

---

### Database Functions

Located in `apps/db-init/db/init/90-northwind-auth-functions.sql`:

| Function | Purpose | Line |
|----------|---------|------|
| `acl.create_principal_with_password()` | Register user with password | 233-263 |
| `acl.find_principal_by_email()` | Find user by email | 9-13 |
| `acl.get_password_hash()` | Get hash for verification (SECURITY DEFINER) | 20-24 |
| `acl.get_principal_details()` | Get user info for JWT | 207-227 |
| `acl.is_token_valid()` | Check refresh token validity | 140-150 |
| `acl.revoke_token()` | Revoke single token | 111-119 |
| `acl.revoke_principal_tokens()` | Revoke all user tokens | 97-105 |
| `acl.upsert_oauth_identity()` | Link OAuth account | 30-91 |
| `acl.get_db_role()` | Map principal to DB role | 172-201 |
| `acl.update_password()` | Change password | 269-278 |
| `acl.verify_email()` | Mark email verified | 284-291 |

---

### Security Features

**Password Hashing** (`auth.service.ts:36-42`):
```typescript
const passwordHash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
});
```

**JWT Tokens** (`auth.service.ts:126-152`):
- Algorithm: RS256
- Access Token: 15 minutes
- Refresh Token: 30 days with family tracking
- Issuer: `gql-cms-api`
- Audience: `gql-cms-client`

**Refresh Token Rotation** (`auth.service.ts:189-212`):
- Old token revoked on use
- New token issued with same family ID
- Family revoked if reuse detected (security breach)
- Tracks `last_used_at` for audit

**Cookie Security** (`auth.controller.ts:224-242`):
```typescript
// Access token
res.cookie('access_token', accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 15 * 60 * 1000,
});

// Refresh token (restricted path)
res.cookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/northwind/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000,
});
```

---

### Complete Auth Flow Example

```bash
# 1. Register new user
curl -X POST http://localhost:5433/northwind/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"pass123","kind":"customer"}' \
  -c cookies.txt

# 2. Verify logged in (cookies set from registration)
curl http://localhost:5433/northwind/auth/me -b cookies.txt
# Returns: { "success": true, "principal": { ... } }

# 3. Query GraphQL with authentication
curl http://localhost:5433/graphql \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"query":"{ allCustomers { nodes { customerId companyName } } }"}'

# 4. Refresh token (get new access token)
curl -X POST http://localhost:5433/northwind/auth/refresh \
  -b cookies.txt -c cookies.txt

# 5. Logout from this device
curl -X POST http://localhost:5433/northwind/auth/logout -b cookies.txt

# 6. Login again
curl -X POST http://localhost:5433/northwind/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"pass123"}' \
  -c cookies.txt

# 7. Logout from ALL devices
curl -X POST http://localhost:5433/northwind/auth/logout-all -b cookies.txt
```

---

### Testing

E2E tests cover all flows (`apps/gql-api-e2e/src/gql-api/northwind-auth.spec.ts`):

**Test Coverage:**
- ✅ User registration (customer/employee)
- ✅ Duplicate email validation
- ✅ Email format validation
- ✅ Login with valid credentials
- ✅ Login with invalid credentials
- ✅ Get current user (`/me`)
- ✅ Token refresh and rotation
- ✅ Logout single device
- ✅ Logout all devices
- ✅ Cookie security attributes (HttpOnly, Path)
- ✅ Complete integration flow

**Run tests:**
```bash
PORT=5433 npx nx e2e gql-api-e2e --grep "Northwind Authentication"
```

---

### Session Variables Set by AuthMiddleware

When a user is authenticated, `req.auth` is populated by `AuthMiddleware` (`apps/gql-api/src/app/auth.middleware.ts:14-35`) and passed to PostGraphile's `pgSettings`:

```typescript
{
  role: 'app_user',                           // DB role for this principal
  'app.principal_id': '550e8400-e29b-...',   // UUID for acl.current_principal()
  'gql_cms.user_id': '550e8400-e29b-...',    // (Compatibility, not used)
  'jwt.claims.user_id': '550e8400-e29b-...', // (Legacy)
  'jwt.claims.email': 'user@example.com',
  'jwt.claims.scopes': '',
}
```

RLS policies in the `acl` schema use `acl.current_principal()` which reads `app.principal_id`.

---

### OAuth Support (Prepared)

The `auth.service.ts:302-319` includes `upsertOAuthIdentity()` method for OAuth/OIDC integration:

```typescript
async upsertOAuthIdentity(
  provider: string,
  providerSub: string,
  providerEmail: string,
  profileData: any,
  kind: 'customer' | 'employee' = 'customer',
  displayName?: string
) {
  // Calls acl.upsert_oauth_identity() function
  // Links OAuth account to existing user or creates new
}
```

To implement OAuth:
1. Add controller methods for `/auth/:provider/start` and `/auth/:provider/callback`
2. Use `openid-client` library for OIDC discovery
3. Call `authService.upsertOAuthIdentity()` after successful OAuth callback
4. Issue JWT token pair and set cookies

---

### Answers to Section 17 TODOs

✅ **argon2id chosen** - Implemented in `auth.service.ts:36-42`
✅ **Cookie strategy: SameSite=Lax** - Balances security and usability
✅ **GraphiQL in dev only** - Configured in `app.module.ts:26-27`
✅ **Token rotation** - Full family-based rotation with reuse detection
✅ **Role resolution** - Via `acl.get_db_role()` function

---

## Recommendation

**For Production Use**: Use the Northwind auth system (`/northwind/auth/*` endpoints with `acl` schema)

**For Learning**: Study the `gql_cms` schema structure and RLS policies, then implement auth following the Northwind pattern

**Migration Path**: If you want to use `gql_cms` schema with working auth:
1. Copy `northwind-auth` module as `gql-cms-auth`
2. Update controller decorator: `@Controller('gql-cms/auth')` or `@Controller('gql_cms/auth')`
3. Add auth tables to `gql_cms` schema (see section 5.2)
4. Update SQL function calls to use `gql_cms` instead of `acl`
5. Change session variable from `app.principal_id` to `gql_cms.user_id`
6. Update PostGraphile route from `/graphql` to `/gql_cms/graphql` in `app.module.ts`

---

**This system is production-ready and fully tested. All endpoints work as documented.**
