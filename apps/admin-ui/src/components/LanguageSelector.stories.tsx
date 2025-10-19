import type { StoryObj } from '@storybook/nextjs';
import { LanguageSelector } from '@/components/LanguageSelector';


const meta //: Meta<typeof LanguageSelector>
  = {
  title: 'Components/LanguageSelector',
  component: LanguageSelector,
  parameters: {
    nextjs: {
      appDirectory: true
    }
  }
}; //satisfies Meta<typeof LanguageSelector>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    nextjs: {
      navigation: {
        // pathname: '/',
      }
    }
  }
};
export const en: Story = {
  parameters: {
    nextjs: {
      navigation: {
        segments: [['lang', 'en']]
      }
    }
  }
};
export const gb: Story = {
  parameters: {
    nextjs: {
      navigation: {
        segments: [['lang', 'en-gb']]
      }
    }
  }
};
export const es: Story = {
  parameters: {
    nextjs: {
      navigation: {
        segments: [['lang', 'es']]
      }
    }
  }
};
