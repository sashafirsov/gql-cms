# GraphQL CMS

A reference project with best practices of

* ✓ ( [graph](https://cdn.xml4jquery.com/gql-cms/nx-graph.html) ) monorepo with multi-tier apps support from DB via web services to UI with reusable libs.
* ✓ Two [ACL/authorization](docs/ACL.md) systems (simple per-resource + Zanzibar ReBAC)
* ✓ Native PostgreSQL Row-Level Security (RLS)
* ✓ GraphQL API with PostGraphile and NestJS backend
* ✓ Complete authentication with JWT + argon2 + token rotation
* ✓ NextJS Admin UI with Apollo Client
* ✓ Reusable library with [admin-ui components]()
* [] Semantic UI Theme TBD
* [] StoryBook pixel regression test + review git flow
* [] OpenAPI use for natural language query to GraphQL
* [] UI component generator with i18n, StoryBook, MSW web services mocking
* [] Synthetic Persona complete seed data
* [] ORM-driven DAL to keep DB schema source in code.
* [] k8s Helm chart local and environment with sample deployments into 3 major clouds.
* [] GHA based deployment, deploy branch by tag
* [] Ephemeral Environment on demand, PR-level temporary dynamic environment, e2e tests run. [Vercel?](https://vercel.com/docs/deployments/environments)
* [] OpenTelemetry sample integrations, local and within k8s

<details>
    <summary>Screencast</summary>
        <h6>monorepo project graph</h6>
        <a href="https://cdn.xml4jquery.com/gql-cms/nx-graph.html">
            <img src="docs/screencast/nx-graph.png" alt=""/>
        </a> 
        <h6>Shared UI `auth-ui` lib</h6>
        <a href="https://cdn.xml4jquery.com/gql-cms/auth-ui/storybook/?path=/story/auth-logincomponent--default">
            <img src="docs/screencast/auth-ui-login-component.png" alt=""/>
        </a> 
        <h6>Admin UI lib</h6>
        <a href="https://cdn.xml4jquery.com/gql-cms/admin-ui/storybook-static/?path=/story/components-heading--example">
            <img src="docs/screencast/admin-ui-heading.png" alt=""/>
        </a> 
        <h6>Admin UI login</h6>
        <img src="docs/screencast/admin-ui-login.png" alt=""/>
        <h6>Admin UI register user</h6>
        <img src="docs/screencast/admin-ui-register.png" alt=""/>
        <h6>Admin UI dashboard</h6>
        <img src="docs/screencast/admin-ui-dashboard.png" alt=""/>
        <h6>Admin UI URLs</h6>
        <img src="docs/screencast/admin-ui-urls.png" alt=""/>
        <h6>Admin UI Analytics</h6>
        <img src="docs/screencast/admin-ui-analytics.png" alt=""/>
        <h6>Admin UI Users</h6>
        <img src="docs/screencast/admin-ui-urls.png" alt=""/>
        <h6>Admin UI User details</h6>
        <img src="docs/screencast/admin-ui-user.png" alt=""/>
        <h6>Docker Desktop</h6>
        <img src="docs/screencast/docker-desktop.png" alt=""/>
        <h6>GraphQL console</h6>
        <img src="docs/screencast/graphql-console.png" alt=""/>
</details>

___

# Start development

    npm install --legacy-peer-deps # @storybook/test-runner still in legacy mode
    npm start # would build and run all applications above in docker

* http://localhost:4200/ - web UI
* http://localhost:5433/status - health check for API
* http://localhost:5433/graphiql - GraphQL console for DB inspection and development

Create a user to create and see [slugs](docs/slug.md)
 
For an analytics view, use **manager@example.com**  with _Manager123#_ password


# Sub-projects
Each application also could be run separately.

* `admin-ui` - NextJS Admin UI with Apollo Client
* `gql-api` - NestJS backend with PostGraphile GraphQL API
* `db-init` - Database initialization service with migration scripts
* `gql-cms-db` - PostgreSQL 15 in Docker with RLS policies
* [auth-ui](lib/auth-ui/README.md) - shared authentication flow UI library

# `admin-ui`

    nx serve admin-ui # or

* Navigate to http://localhost:4200. The app will automatically reload if you change any of the source files.
* It also would run the `gql-api` application in the background with proxy to `http://localhost:4200/api`.
* Use StoryBook for components development

```bash
    npm run storybook 
```

# `db-init`

    nx serve db-init

TBD: Populates the Synthetic Persona data into Postgres DB and gives the status on 
http://localhost:3000/status

# `gql-api`

    nx serve gql-api

will run the gql-api application. Navigate to `http://localhost:5433/graphiql` for GraphQL console. 
The app will automatically reload if you change any of the source files.

# Development

## Build

    nx build db-init
    nx build gql-api
    nx build admin-ui

## Database and GraphQL server with Docker

    docker-compose up --build

* GraphQL console is available at http://localhost:5433/graphiql
* GraphQL API is available at http://localhost:5433/graphql
* Authentication endpoints at http://localhost:5433/northwind/auth/* (working implementation)

## UI components development

* [auth-ui](lib/auth-ui/README.md) - authentication components, uses StoryBook for development

## Admin UI

    nx serve admin-ui

* Admin UI is available at http://localhost:4200/
* API proxy is available at http://localhost:4200/api

## Auth UI Library - Dual Nature Architecture

The `@gql-cms/auth-ui` library in `lib/auth-ui/` implements a **dual-nature pattern** combining the benefits of 
both source-level and publishable libraries:

**1. Source-Level Mode (Within Monorepo)**

- TypeScript resolves imports via `customConditions: ["@gql-cms/source"]` in tsconfig.base.json
- Package exports map to raw `.ts` source files: `"@gql-cms/source": "./src/index.ts"`
- No build step required during development - instant hot-reload
- Fast iteration with direct TypeScript compilation

**2. Publishable Mode (External Consumption)**

- Vite builds compiled artifacts to `dist/` folder
- Standard package exports: `"import": "./dist/index.js"`
- Type declarations included for external consumers
- Can be published to npm with proper versioning

**How It Works:**

```json
// lib/auth-ui/package.json exports
".": {
"@gql-cms/source": "./src/index.ts", // ← Monorepo uses this
"types": "./dist/index.d.ts",
"import": "./dist/index.js", // ← External npm consumers use this
"default": "./dist/index.js"
}
```

**Benefits:**

- ✅ Best of both worlds: fast development + npm publishability
- ✅ No "build everything on every change" slowdown
- ✅ Proper package boundaries maintained
- ✅ External projects can consume as standard npm package

To build for publishing: `nx build @gql-cms/auth-ui`

<details>
    <summary>
        Run the built Admin UI (production build) from the command line
    </summary>

1. Build it (from repo root):

       npx nx build admin-ui

2. Run the built server (from repo root):

       node dist\\apps\\admin-ui\\.next\\standalone\\server.js

    - Alternatively, using an npm script we added:

      npm run serve:admin-ui:prod

    - Or from within apps/admin-ui directory:

      npm run serve:dist

Notes:

- The production server entry point is in dist/apps/admin-ui/.next/standalone/server.js (Next.js standalone output).
- The server listens on port 4200 by default (set via PORT env var). You can change PORT to override.

For API working with a live database, run it in Docker as above. Without API available, the Admin UI would use Synthetic Persona mock data from `db-init`.
</details>

## Authentication & Authorization

This project demonstrates **two complete authorization systems**:

### 1. Simple Per-Resource ACL (`gql_cms` schema)

- **Status**: Database schema and RLS policies implemented
- **Tables**: `gql_cms.users`, `gql_cms.documents`, `gql_cms.user_roles`, `gql_cms.document_acl`
- **Auth**: Not yet implemented (patterns documented in `docs/ACL.md`)
- **Use case**: Learning, simple CMS projects

### 2. Zanzibar-style ReBAC (`acl` schema) ✅ Production-Ready

- **Status**: Fully implemented and tested
- **Tables**: `acl.principals`, `acl.tuples`, `acl.objects`, `acl.user_credentials`, `acl.refresh_tokens`
- **Auth**: Complete authentication at `/northwind/auth/*` endpoints
- **Features**:
    - Password auth with argon2id hashing
    - RS256 JWT with access + refresh tokens
    - Token rotation with family tracking
    - HttpOnly secure cookies
    - E2E tested
- **Use case**: Production multi-tenant systems

### Quick Auth Test

```bash
# Register a new user
curl -X POST http://localhost:5433/northwind/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"pass123","kind":"customer"}' \
  -c cookies.txt

# Get current user info
curl http://localhost:5433/northwind/auth/me -b cookies.txt

# Query GraphQL with authentication
curl http://localhost:5433/graphql \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"query":"{ allCustomers { nodes { customerId companyName } } }"}'
```

See `docs/ACL.md` for complete documentation.

## Database Schema

The project includes multiple schemas for different purposes:

- **`gql_cms` schema**: Simple CMS with documents and users
    - Demo tables: `forum_users`, `post` (legacy examples)
    - ACL tables: `users`, `documents`, `user_roles`, `document_acl`
- **`acl` schema**: Zanzibar authorization system
    - Core: `principals`, `tuples`, `objects`, `relations`
    - Auth: `user_credentials`, `oauth_identities`, `refresh_tokens`
- **`northwind` schema**: Sample e-commerce database (products, orders, customers)

# Author's notes

The project is bootstrapped with [Nx](https://nx.dev). The `gql-api` is built with [NestJS](https://nestjs.com/) and [Graphile](https://www.graphile.org/).
The `admin-ui` is built with [NextJS](https://nextjs.org/).

The environment is

* Ubuntu Linux in WSL on Windows 11
* Node v24.10.0 ( latest )
* IDE: IntelliJ Idea Ultimate 2023.2.3
* DB: PostgreSQL 15.7
* AI: Claude 4.5 Sonnet
* Docker Desktop

Published on [GitHub](https://github.com/sashafirsov/gql-cms)

# GqlCms

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Your new, shiny [Nx workspace](https://nx.dev) is almost ready ✨.

[Learn more about this workspace setup and its capabilities](https://nx.dev/nx-api/node?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!

## Finish your CI setup

[Click here to finish setting up your workspace!](https://cloud.nx.app/connect/GpAuhP12t7)

## Run tasks

To run the dev server for your app, use:

```sh
npx nx serve gql-api
```

To create a production bundle:

```sh
npx nx build gql-api
```

To see all available targets to run for a project, run:

```sh
npx nx show project gql-api
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

Use the plugin's generator to create new projects.

To generate a new application, use:

```sh
npx nx g @nx/node:app demo
```

To generate a new library, use:

```sh
npx nx g @nx/node:lib mylib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/nx-api/node?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:

- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
