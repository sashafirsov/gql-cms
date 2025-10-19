import type { StoryObj } from '@storybook/nextjs';
import { Heading } from '@/components/Heading';


const meta
  // : Meta<typeof Heading>
  = {
  title: 'Components/Heading',
  component: Heading
};

export default meta;

// export const Default = () => <Heading>Sample Heading</Heading>;

type Story = StoryObj<typeof meta>;

export const Example: Story = {
  args: {
    // children: <>Sample Heading</>
    title: 'Sample Heading'
  },
  parameters: {
    nextjs: {
      appDirectory: true,
      router: {
        pathname: '/',
        asPath: '/',
        query: {
          id: '1'
        }
      }
    }
  }
};