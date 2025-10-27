# GraphQL API 

# PostGraphile + NestJS
[PostGraphile](https://www.graphile.org/postgraphile/) provides NodeJS capabilities to work with PostgreSQL database 
and auto-generate a GraphQL API based on the database schema.

The API web server is built with [NestJS](https://nestjs.com/),
a Node.js framework for building efficient, reliable, and scalable server-side applications.

# out of scope
While the solutions below have the simplest setup, 
the server customization and business logic change reside beyond the Node.js tech stack in this demo project.

For standard web application needs those are more than sufficient, and we highly recommend them before considering building custom GraphQL servers.

## pg_graphql + PostgREST
The PostgreSQL native GraphQL implementation by
* [pg_graphql](https://supabase.com/docs/guides/database/extensions/pg_graphql) 
extension for interacting with the database using GraphQL instead of SQL.
* and [PostgREST](https://postgrest.org) API server that turns your PostgreSQL database directly into a RESTful API.

## Hasura
[Hasura GraphQL Engine](https://hasura.io/) is a popular open-source engine that provides instant GraphQL APIs over PostgreSQL databases. 
It offers Rust performance, GraphQL Federation/API gateway capabilities, authorization, and more, 
making it a powerful choice for building GraphQL APIs quickly.

# Implementation details

`db-init` API is available directly at port 3000.

## Populate Synthetic Persona data
    nx serve db-init

Navigate to `http://localhost:3000/status`. The status of the population process would be shown.

## Tests
    nx test db-init
    nx test gql-api
    nx test admin-ui

## E2E Tests
    nx e2e admin-ui-e2e

## Linting
    nx lint db-init
    nx lint gql-api
    nx lint admin-ui

## Formatting
    npx prettier --write "apps/**/src/**/*.ts"
    npx prettier --write "apps/**/src/**/*.tsx"
    npx prettier --write "libs/**/src/**/*.ts"
    npx prettier --write "libs/**/src/**/*.tsx"
