import { NextConfig } from 'next';

const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
// In Docker production, use service name 'graphql'. In local dev, use 'localhost'
// Note: This is evaluated at build time, so we check NODE_ENV
const isProduction = process.env.NODE_ENV === 'production';
const apiUrl = isProduction ? 'http://graphql:5433' : 'http://localhost:5433';

const nextConfig: NextConfig = {
    output: 'standalone',
    typedRoutes: false,
    // Transpile local libraries to ensure CSS modules work correctly
    transpilePackages: ['@gql-cms/auth-ui'],
    // Use this to set Nx-specific options
    // See: https://nx.dev/recipes/next/next-config-setup
    nx: {},
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://localhost:3000/api/:path*'
            },
            {
                source: '/northwind/auth/:path*',
                destination: `${apiUrl}/northwind/auth/:path*`
            },
            {
                source: '/gql-cms/auth/:path*',
                destination: `${apiUrl}/gql-cms/auth/:path*`
            },
            {
                source: '/graphql',
                destination: `${apiUrl}/graphql`
            },
            {
                source: '/graphiql',
                destination: `${apiUrl}/graphiql`
            }
        ];
    }
};

const plugins = [
    // Add more Next.js plugins to this list if needed.
    withNx
];

module.exports = composePlugins(...plugins)(nextConfig);
