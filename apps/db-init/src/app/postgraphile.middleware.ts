// src/postgraphile.middleware.ts
import { postgraphile } from 'postgraphile';

export const postgraphileMiddleware = postgraphile(
    process.env.DATABASE_URL || 'postgres://user:password@host:port/database', // Replace it with your actual database connection string
    'app', // database schema
    {
        graphiql: true, // Enable GraphiQL interface
        graphqlRoute: '/graphql' // Your desired GraphQL endpoint
        // ... other PostGraphile options
    }
);
