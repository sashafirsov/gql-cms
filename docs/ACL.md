# Web Authentication & Authorization Stack (Clean Full Blueprint)

**Stack**: Web (Apollo Client) → NestJS (Auth endpoints + PostGraphile middleware) → PostgreSQL (RLS as source of truth)

---

## 0) Goals

* Keep **authorization in Postgres** via Row‑Level Security (RLS).
* Use **cookies** (HttpOnly) so tokens never live in JavaScript.
* Support both **password** auth and **3rd‑party OAuth/OIDC**.
* Make GraphQL transport **stateless** (except for cookies) and let **pgSettings** carry identity → Postgres role mapping.

---

## 1) High‑Level Architecture

```
[Browser: Apollo Client]
   | HTTP(S) + cookies (SameSite)
   v
[NestJS]
  ├─ /auth/login | /auth/refresh | /auth/logout
  ├─ /auth/:provider/start | /auth/:provider/callback (OIDC + PKCE)
  └─ /graphql (PostGraphile mounted; pgSettings from req.auth)
   |
   v
[PostgreSQL]
  ├─ Roles: anonymous, app_user, manager, admin, bot
  ├─ Schema: gql_cms containing tables: users, documents, document_acl, user_identity, refresh_token
  └─ RLS policies read current_setting('jwt.claims.*')
```

**Key concept**: Nest verifies cookies → attaches `req.auth` → PostGraphile `pgSettings` sets `role` and `jwt.claims.user_id` per request. RLS enforces access.

---

## 2) Client (Apollo) Setup

```ts
import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';

const httpLink = new HttpLink({ uri: '/graphql', credentials: 'include' });

export const client = new ApolloClient({
  link: ApolloLink.from([httpLink]),
  cache: new InMemoryCache(),
});
```

**Notes**

* Use **same‑origin** where possible.
* For mutations, add **double‑submit CSRF** header (e.g., `X-CSRF-Token`).
* Subscriptions: use `graphql-ws`; cookies flow to WSS on same site.

---

## 3) NestJS: PostGraphile + Auth Middleware

```ts
// app.module.ts
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { postgraphile } from 'postgraphile';
import { AuthMiddleware } from './auth/auth.middleware';

@Module({})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');

    consumer
      .apply(postgraphile(process.env.DATABASE_URL!, 'gql_cms', {
        graphiql: process.env.NODE_ENV !== 'production',
        enhanceGraphiql: process.env.NODE_ENV !== 'production',
        pgDefaultRole: 'anonymous',
        pgSettings: async (req: any) => ({
          role: req.auth?.role ?? 'anonymous',
          'jwt.claims.user_id': req.auth?.userId ?? null,
          'jwt.claims.email': req.auth?.email ?? null,
          'jwt.claims.scopes': (req.auth?.scopes ?? []).join(','),
        }),
      }))
      .forRoutes('/graphql');
  }
}
```

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

* **Do not** create a global Postgres role named `owner`. Ownership should be represented as **ACL data**, not a DB role.
* Keep DB roles coarse (`anonymous`, `app_user`, `manager`, `admin`, `bot`), and model ownership per resource.

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

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- crypt(), gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- optional for email search

CREATE TABLE gql_cms.users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      citext UNIQUE NOT NULL,
  full_name  text,
  password   text, -- bcrypt/argon hash if using password login; nullable for pure-OAuth
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gql_cms.documents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES gql_cms.users(id) ON DELETE CASCADE,
  full_url   text NOT NULL,
  short_url  text UNIQUE NOT NULL,
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- OAuth identities
CREATE TABLE gql_cms.user_identity (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES gql_cms.users(id) ON DELETE CASCADE,
  provider     text NOT NULL,
  provider_sub text NOT NULL,
  email        citext,
  profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_refresh_enc bytea,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_sub)
);

-- Refresh ledger
CREATE TABLE gql_cms.refresh_token (
  jti        uuid PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES gql_cms.users(id) ON DELETE CASCADE,
  issued_at  timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text,
  ip         inet
);
```

### 5.3 Roles (DB‑level, coarse)

```sql
CREATE ROLE IF NOT EXISTS anonymous NOLOGIN;
CREATE ROLE IF NOT EXISTS app_user NOLOGIN;
CREATE ROLE IF NOT EXISTS manager  NOLOGIN;
CREATE ROLE IF NOT EXISTS admin    NOLOGIN;
CREATE ROLE IF NOT EXISTS bot      NOLOGIN;
CREATE ROLE IF NOT EXISTS api LOGIN PASSWORD '***';
```

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

1. `/auth/:provider/start` → build authorization URL with PKCE, save `{state, nonce, code_verifier}`.
2. `/auth/:provider/callback` → exchange `code`, link/create `app_user`, mint app cookies.

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

## 16) Curl Smoke Tests

```bash
# 1) login (password)
curl -i -X POST https://api.example.com/auth/login \
  -d '{"email":"a@b.com","password":"secret"}' \
  -H 'Content-Type: application/json'

# 2) query with cookies
curl -i https://api.example.com/graphql \
  -H 'Content-Type: application/json' \
  -H 'X-CSRF-Token: <value from cookie>' \
  --data '{"query":"{ currentUser { id email } }"}' \
  --cookie 'access_token=...; csrf_token=...'

# 3) refresh
curl -i https://api.example.com/auth/refresh --cookie 'refresh_token=...'
```

---

## 17) Open Questions / TODOs

* Pick argon2 (Nest) vs bcrypt in DB for password hashing.
* Decide which OAuth providers to enable first (Google/GitHub/Azure/Auth0).
* Choose cookie `SameSite` strategy (Lax vs Strict) based on cross‑origin needs.
* Decide whether to expose GraphiQL in staging only.
* Finalize role resolution rules and admin on‑call tooling (revocations, audit).

---

** This blueprint is ready to apply to your Nx monorepo; next step:
** generate Nest modules/services, migrations, and a tiny React login page (redirect/popup) wired to `/auth/:provider/start`.
