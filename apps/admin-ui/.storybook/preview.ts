// Replace your-framework with nextjs or nextjs-vite
import type { Preview } from '@storybook/nextjs';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getRouter } from "@storybook/nextjs/router.mock";

export const preview: Preview = {
  parameters: {
    nextjs: {
      appDirectory: true,
      // 👇 Override the default router properties
      router: {
         // basePath: '/src/app/',
      },
    },
  },
  async beforeEach() {
    // 👇 Manipulate the default router method mocks
    getRouter().push.mockImplementation(() => {
      /* ... */
    });
  },
};