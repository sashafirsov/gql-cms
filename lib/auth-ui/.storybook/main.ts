import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
    stories: ['../**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
    addons: ['msw-storybook-addon'],
    framework: {
        name: '@storybook/nextjs',
        options: {
            builder: {
                viteConfigPath: 'vite.config.ts',
            },
        },
    },
    staticDirs: ['../public'],
};

export default config;

// To customize your Vite configuration you can use the viteFinal field.
// Check https://storybook.js.org/docs/react/builders/vite#configuration
// and https://nx.dev/recipes/storybook/custom-builder-configs
