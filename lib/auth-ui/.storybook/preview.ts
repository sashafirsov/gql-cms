// preview.ts
// Storybook preview configuration with MSW initialization

import { initialize, mswLoader } from 'msw-storybook-addon';
import type { Preview } from '@storybook/nextjs';

// Initialize MSW
initialize({
  onUnhandledRequest: 'bypass',
});

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  loaders: [mswLoader],
};

export default preview;
