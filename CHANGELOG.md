# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed

#### Database Schema
- **BREAKING**: Renamed table `gql_cms.user` to `gql_cms.forum_users` to avoid GraphQL type naming conflict with `gql_cms.users`
  - Updated foreign key in `gql_cms.post` table: `author_id` now references `gql_cms.forum_users(id)`
  - Updated seed data in `apps/db-init/db/init/01-data.sql`
  - This resolves PostGraphile error: "A type naming conflict has occurred - two entities have tried to define the same type 'UsersOrderBy'"
  - **Migration**: If you have existing data in `gql_cms.user`, run: `ALTER TABLE gql_cms.user RENAME TO forum_users;`

#### Documentation
- **Updated `docs/ACL.md`**: Complete rewrite to document actual implementation
  - Added clear distinction between two ACL systems:
    - System 1: `gql_cms` schema (simple per-resource ACL, auth not implemented)
    - System 2: `acl` schema (Zanzibar ReBAC, fully implemented with working auth)
  - Fixed schema name mismatches (`public` → `gql_cms`)
  - Fixed session variable names (`jwt.claims.user_id` → `gql_cms.user_id` and `app.principal_id`)
  - Clarified that "roles" are table-based, not PostgreSQL `CREATE ROLE` statements
  - Documented actual table structures (removed non-existent fields like `password` in `gql_cms.users`)
  - Added complete API documentation for `/northwind/auth/*` endpoints
  - Added curl examples, security features, and E2E test coverage details
  - Documented proper endpoint namespacing: `/gql_cms/graphql` and `/gql_cms/auth/*`

- **Updated `README.md`**: Enhanced project overview
  - Added authentication & authorization section highlighting both systems
  - Added quick auth test examples with curl commands
  - Added database schema overview with all three schemas
  - Updated sub-projects descriptions
  - Added link to Northwind auth endpoints

- **Updated `CLAUDE.md`**: Technical updates for AI assistant
  - Added note about endpoint namespacing (`/graphql` → `/gql_cms/graphql`)
  - Updated authentication flow section to distinguish between two systems
  - Added core tables listing for both `gql_cms` and `acl` schemas
  - Documented working Northwind auth implementation

### Notes

**Endpoint Namespacing (Planned)**:
- Current: PostGraphile serves `gql_cms` schema at `/graphql`
- Recommended: Move to `/gql_cms/graphql` for better organization
- See `docs/ACL.md` section 3 for implementation details

**Authentication Status**:
- ✅ **Production-ready**: Northwind auth at `/northwind/auth/*` (register, login, logout, refresh, me)
- ⚠️ **Not implemented**: `gql_cms` auth at `/gql_cms/auth/*` (patterns documented, database ready)

**Testing**:
To apply these database changes:
```bash
docker-compose down
docker-compose up --build -d
```

Or if upgrading existing database:
```sql
-- Run this migration manually
ALTER TABLE gql_cms.user RENAME TO forum_users;
```
