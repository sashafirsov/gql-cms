import type { StoryObj } from '@storybook/nextjs';
import { expect } from 'storybook/test';

import { NavBar } from '@/components/NavBar';


const meta //: Meta<typeof NavBar>
  = {
  title: 'Components/NavBar',
  component: NavBar,
  parameters: {
    nextjs: {
      appDirectory: true
    }
  }
}; //satisfies Meta<typeof NavBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    nextjs: {
      navigation: {
        // pathname: '/',
      }
    }
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('English US')).toBeInTheDocument();
  }
};
export const en: Story = {
  parameters: {
    nextjs: {
      navigation: {
        segments: [['lang', 'en']]
      }
    }
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('English US')).toBeInTheDocument();
  }
};
export const gb: Story = {
  parameters: {
    nextjs: {
      navigation: {
        segments: [['lang', 'en-gb']]
      }
    }
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('English GB')).toBeInTheDocument();
  }
};
export const es: Story = {
  parameters: {
    nextjs: {
      navigation: {
        segments: [['lang', 'es']]
      }
    }
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('Español')).toBeInTheDocument();
  }
};
