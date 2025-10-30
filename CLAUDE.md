# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GraphQL CMS (`gql-cms`) is an Nx monorepo demonstrating best practices for a Content Management System with:
- **NestJS** GraphQL API using **PostGraphile** for auto-generated GraphQL from PostgreSQL
- **NextJS** Admin UI with React 19, Apollo Client, and Semantic UI Theme
- **PostgreSQL** with native Row-Level Security (RLS) for fine-grained authorization
- **ACL-based authorization** using per-resource access control (owner/manager/viewer roles)
- Docker-based development and deployment

## Architecture

### Three-Tier Architecture
```
[NextJS Admin UI (Apollo Client)]
    ↓ HTTP + GraphQL
[NestJS API (PostGraphile middleware)]
    ↓ PostgreSQL protocol
[PostgreSQL with RLS policies]
```

**Key Design Principle**: Authorization lives in the database via RLS policies, not in application code. The NestJS layer:
1. Authenticates requests (via `AuthMiddleware` - currently stubbed)
2. Sets PostgreSQL session variables (`jwt.claims.user_id`, `role`) via PostGraphile's `pgSettings`
3. PostGraphile generates GraphQL schema from DB and proxies queries
4. RLS policies enforce access control based on session variables

### Monorepo Structure
- `apps/admin-ui/` - NextJS 15 frontend with Apollo Client
- `apps/gql-api/` - NestJS backend with PostGraphile middleware
- `apps/db-init/` - Database initialization service and seed data
- `apps/db-init/db/init/` - SQL migration files for schema, ACL, and seed data

## Common Development Commands

### Full Stack Development
```bash
# Install dependencies
npm install

# Run all services in Docker (DB + API + Admin UI)
npm start
# This builds all apps, then runs docker-compose up
# Access points:
# - Admin UI: http://localhost:4200
# - GraphQL API: http://localhost:5433/graphql
# - GraphiQL: http://localhost:5433/graphiql
# - DB Init status: http://localhost:5434/status

# Run individual services (outside Docker)
nx serve admin-ui        # Dev server at http://localhost:4200, auto-proxies /api to gql-api
nx serve gql-api         # API server at http://localhost:5433
nx serve db-init         # DB init at http://localhost:3000
```

### Building
```bash
npm run build            # Build all apps
nx build admin-ui        # Build specific app
nx build gql-api
nx build db-init

# Run production build of admin-ui locally
npm run serve:admin-ui:prod   # or: node dist/apps/admin-ui/.next/standalone/server.js
```

### Testing
```bash
npm test                 # Run all tests
nx test admin-ui         # Test specific app
nx test gql-api
nx test db-init

# E2E tests
npm run e2e              # All e2e tests
nx e2e admin-ui-e2e      # Specific e2e suite
```

### Linting & Formatting
```bash
npm run lint             # Lint all apps
nx lint admin-ui         # Lint specific app

npm run format           # Format all files with Prettier
npm run format:check     # Check formatting without modifying
```

### Database Management
```bash
# Start just the database container
docker-compose up gql-cms-db

# Connect to PostgreSQL
docker exec -it gql-cms-db psql -U postgres

# View database logs
docker logs gql-cms-db
```

### Docker Operations
```bash
npm run docker           # Build and start all Docker services
docker-compose up --build -d   # Rebuild and start detached
docker-compose down      # Stop all services
docker-compose logs -f admin-ui  # Follow logs for specific service
```

### Nx Utilities
```bash
npx nx graph             # Visualize project dependencies
npx nx show project admin-ui    # Show all targets for a project
npx nx affected --target=test   # Run tests only for affected projects
```

## Authorization System (ACL with RLS)

The project implements a sophisticated authorization model using PostgreSQL Row-Level Security (RLS). See `docs/ACL.md` for the complete blueprint.

### Database Roles (Coarse-Grained)
PostgreSQL DB roles used by the application:
- `anonymous` - Unauthenticated users (default)
- `app_user` - Authenticated regular users
- `manager` - Global manager (can manage users and documents)
- `admin` - Full administrative access
- `bot` - Read-only service accounts
- `authorizer` - Can only create users

### ACL Tables (Fine-Grained)
Per-resource authorization is stored in ACL tables:

1. **`gql_cms.user_roles`** - Global roles assigned to users (e.g., admin, manager, bot)
2. **`gql_cms.document_acl`** - Per-document access (owner/manager roles)
3. **`gql_cms.user_acl`** - Per-user access (owner can edit their own profile)

### How RLS Works
1. Auth middleware (`apps/gql-api/src/app/auth.middleware.ts`) verifies JWT and sets `req.auth`
2. PostGraphile's `pgSettings` function sets session variables:
   - `role` → PostgreSQL role for this request
   - `jwt.claims.user_id` → Current user UUID
   - `jwt.claims.email` → User email
   - `jwt.claims.scopes` → Comma-separated scopes
3. SQL helper `gql_cms.current_user_id()` reads `gql_cms.user_id` from session
4. RLS policies on tables check:
   - Global roles via `gql_cms.has_global_role('admin')`
   - Per-resource ACLs via `gql_cms.has_doc_role(doc_id, ARRAY['owner','manager'])`

### Example RLS Policy
From `apps/db-init/db/init/26-gql-cms-acl.sql`:
```sql
-- Users can see documents they own/manage, or if they're admin/manager/bot
CREATE POLICY documents_select ON gql_cms.documents FOR SELECT
USING (
  gql_cms.has_doc_role(id, ARRAY['owner','manager'])
  OR gql_cms.has_global_role('manager')
  OR gql_cms.has_global_role('admin')
  OR gql_cms.has_global_role('bot')
);
```

### Ownership Assignment
Triggers automatically grant ownership when resources are created:
- Creating a document → creator becomes `owner` in `gql_cms.document_acl`
- Creating a user → user becomes `owner` of their own record in `gql_cms.user_acl`

## Database Schema

Located in `apps/db-init/db/init/`:
- `00-database.sql` - Initial database setup
- `01-data.sql` - Reference data
- `20-gql-cms-schema.sql` - Core schema (users, documents, roles, ACL tables)
- `26-gql-cms-acl.sql` - RLS policies and triggers
- `24-gql-cms-seed.sql`, `30-gql-cms-seed.sql` - Seed data

### Core Tables

**`gql_cms` Schema:**
- `gql_cms.users` - User accounts for ACL system (email, full_name, auth_provider)
- `gql_cms.documents` - Documents/URLs (full_url, short_url, comment)
- `gql_cms.roles` - Global role definitions (admin, manager, bot, authorizer, owner)
- `gql_cms.user_roles` - Users assigned to global roles
- `gql_cms.document_acl` - Per-document access control
- `gql_cms.user_acl` - Per-user access control
- `gql_cms.forum_users` - Legacy demo table (renamed from `user` to avoid naming conflict)
- `gql_cms.post` - Legacy demo posts table

**`acl` Schema (Zanzibar):**
- `acl.principals` - Users, groups, services
- `acl.tuples` - Authorization tuples (subject, relation, object)
- `acl.objects` - Resource catalog
- `acl.user_credentials` - Password auth (argon2id hashes)
- `acl.oauth_identities` - OAuth/OIDC provider links
- `acl.refresh_tokens` - JWT refresh token ledger

## Frontend Architecture (admin-ui)

### Technology Stack
- **NextJS 15** with App Router
- **React 19** (Server and Client Components)
- **Apollo Client** for GraphQL (configured in `src/dal/ApolloClient.ts`)
- **Semantic UI** theming
- **TypeScript**
- **i18n** support with `[lang]` route segments

### Key Patterns
- Apollo Client configured with `credentials: 'include'` for cookie-based auth
- GraphQL endpoint proxied to `/graphql` (connects to gql-api service)
- Route structure: `app/[lang]/` for internationalization
- Component library in `src/components/` with Storybook stories

### Development Notes
- The admin-ui can run standalone with `nx serve admin-ui` (proxies API requests)
- In Docker, it's built as a Next.js standalone output for production
- Storybook available: `npm run storybook` or `nx storybook admin-ui`

## Backend Architecture (gql-api)

### Key Files
- `src/app/app.module.ts` - NestJS module with PostGraphile middleware configuration
- `src/app/auth.middleware.ts` - Authentication middleware (currently stub, see docs/ACL.md for full implementation)
- `src/main.ts` - Application bootstrap

### PostGraphile Configuration
PostGraphile is mounted at `/graphql` (currently serves `gql_cms` schema) and automatically generates:
- GraphQL schema from PostgreSQL tables/views
- Queries, mutations, and subscriptions
- GraphiQL interface (dev only)

**Important**: PostGraphile respects RLS policies. The schema exposes what the current database role can see.

**Note**: The endpoint is currently at `/graphql` but should ideally be namespaced to `/gql_cms/graphql` to distinguish from potential future endpoints for other schemas.

### Authentication Flow

**Two Authentication Systems:**

1. **`gql_cms` Schema** (Not Implemented)
   - Theoretical endpoints at `/gql_cms/auth/*` (see `docs/ACL.md` for patterns)
   - Database schema ready, but no auth endpoints exist

2. **`acl` Schema (Northwind)** ✅ **Working Implementation**
   - Endpoints at `/northwind/auth/*` (register, login, logout, refresh, me)
   - Complete authentication with argon2id + RS256 JWT + token rotation
   - Files: `apps/gql-api/src/app/northwind-auth/`
   - E2E tested: `apps/gql-api-e2e/src/gql-api/northwind-auth.spec.ts`

**Authentication Flow:**
1. Client authenticates via `/northwind/auth/login` (working) or `/northwind/auth/register`
2. Server sets HttpOnly cookies (`access_token`, `refresh_token`)
3. `AuthMiddleware` verifies JWT from cookie and sets `req.auth`
4. PostGraphile's `pgSettings` function maps `req.auth` to PostgreSQL session variables
5. RLS policies enforce access control

See `docs/ACL.md` for complete documentation of both systems.

## Testing Strategy

### Unit Tests
- Jest configuration per app
- Run with `nx test <app-name>`
- Test files: `*.spec.ts` co-located with source

### E2E Tests
- Playwright for admin-ui (`apps/admin-ui-e2e/`)
- Test apps for API integration (`apps/gql-api-e2e/`, `apps/db-init-e2e/`)
- Run with `nx e2e <app-name>-e2e`

### Database Testing
To test RLS policies manually:
```sql
-- Connect as postgres superuser
\c your_database

-- Simulate an authenticated user
BEGIN;
SET LOCAL ROLE app_user;
SELECT set_config('gql_cms.user_id', '<some-uuid>', true);

-- Try queries - should respect RLS
SELECT * FROM gql_cms.documents;

ROLLBACK;
```

## Environment Configuration

Key environment variables (create `.env` file):
```bash
DATABASE_URL=postgres://postgres:password@localhost:5432/gql_cms
NODE_ENV=development
PORT=3000  # or 4200 for admin-ui, 5433 for gql-api

# JWT keys (for authentication - see docs/ACL.md)
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...

# OAuth providers (when implementing auth)
OIDC_GOOGLE_ISSUER=https://accounts.google.com
OIDC_GOOGLE_CLIENT_ID=...
OIDC_GOOGLE_CLIENT_SECRET=...
```

## Working with Nx

This is an Nx monorepo. Key concepts:
- **Projects** are in `apps/` (applications) and `libs/` (shared libraries)
- **Targets** are operations like `build`, `serve`, `test`, `lint`
- **Task caching** speeds up repeated operations
- **Affected commands** only run tasks on changed projects

Common Nx patterns:
```bash
# Run target for all projects
nx run-many --target=test --all

# Run target for affected projects only
nx affected --target=build

# See what's affected by current changes
nx affected:graph

# Clear Nx cache
nx reset
```

## Important Quirks and Gotchas

1. **NextJS Standalone Build**: The production admin-ui build requires copying static assets:
   ```bash
   nx build admin-ui
   cp -r dist/apps/admin-ui/.next/static dist/apps/admin-ui/.next/standalone/dist/apps/admin-ui/.next/static
   ```
   This is handled by Docker, but manual builds need this step.

2. **Database Connection in Docker**: Services depend on `gql-cms-db` healthcheck. If services start before DB is ready, they may need restart: `docker-compose restart gql-cms-gql-api`

3. **Port Conflicts**: Default ports are 4200 (admin-ui), 5433 (gql-api), 5434 (db-init), 5432 (postgres). Check for conflicts.

4. **RLS Security**: When adding new tables, always:
   - Enable RLS: `ALTER TABLE foo ENABLE ROW LEVEL SECURITY;`
   - Create policies for SELECT, INSERT, UPDATE, DELETE
   - Test policies with `SET LOCAL ROLE` simulations

5. **PostGraphile Schema Updates**: PostGraphile automatically reflects DB schema changes. After SQL migrations, restart the gql-api service.

6. **Authentication Not Fully Implemented**: The auth middleware is currently a stub. Implement full authentication following `docs/ACL.md` before production use.

## Development Workflow

When adding new features:

1. **Database changes**: Add SQL migrations to `apps/db-init/db/init/` with numeric prefixes (e.g., `40-new-feature.sql`)
2. **Backend**: PostGraphile auto-generates GraphQL schema from DB - no manual schema needed
3. **Frontend**: Use Apollo Client to query the auto-generated GraphQL API
4. **Testing**: Add unit tests and update e2e tests
5. **Docker**: Rebuild containers if Dockerfile changes: `docker-compose up --build`

When debugging:
- Check GraphiQL at `http://localhost:5433/graphiql` to test queries
- Use `docker logs <container-name>` to view service logs
- Check PostgreSQL logs: `docker exec -it gql-cms-db psql -U postgres -c "SELECT * FROM pg_stat_activity;"`

## Additional Documentation

- `docs/ACL.md` - Complete authentication & authorization blueprint
- `README.md` - Project overview and quick start
- `NOTES.md` - Developer notes and build instructions
