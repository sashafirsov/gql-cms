import { NextConfig } from 'next';

const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
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
                destination: 'http://localhost:5433/northwind/auth/:path*'
            },
            {
                source: '/graphql',
                destination: 'http://localhost:5433/graphql'
            },
            {
                source: '/graphiql',
                destination: 'http://localhost:5433/graphiql'
            }
        ];
    }
};

const plugins = [
    // Add more Next.js plugins to this list if needed.
    withNx
];

module.exports = composePlugins(...plugins)(nextConfig);
