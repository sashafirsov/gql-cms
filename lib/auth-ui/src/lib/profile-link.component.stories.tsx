// profile-link.component.stories.tsx
// Storybook stories for ProfileLink component with functional tests

import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within, fn } from 'storybook/test';
import { ProfileLink } from './profile-link.component';

const meta: Meta<typeof ProfileLink> = {
  title: 'Auth/ProfileLink',
  component: ProfileLink,
  parameters: {
    layout: 'centered',
  },
  args: {
    onClick: fn(),
  },
  argTypes: {
    lang: {
      control: 'select',
      options: ['en', 'es', 'en-gb'],
      description: 'Language for internationalization',
    },
    displayName: {
      control: 'text',
      description: 'User display name',
    },
    showAvatar: {
      control: 'boolean',
      description: 'Show avatar with initials',
    },
    className: {
      control: 'text',
      description: 'Custom CSS class',
    },
    children: {
      control: 'text',
      description: 'Link text (overrides displayName)',
    },
    onClick: {
      action: 'clicked',
      description: 'Click handler',
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Default state with display name
 */
export const Default: Story = {
  args: {
    lang: 'en',
    displayName: 'John Doe',
    showAvatar: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify link is present
    const link = canvas.getByTestId('profile-link');
    await expect(link).toBeInTheDocument();
    await expect(link).toHaveAttribute('href', '/en/profile');

    // Verify display name
    const name = canvas.getByTestId('profile-name');
    await expect(name).toHaveTextContent('John Doe');

    // Verify avatar with initials
    const avatar = canvas.getByTestId('profile-avatar');
    await expect(avatar).toHaveTextContent('JD');
  },
};

/**
 * Single name (one initial)
 */
export const SingleName: Story = {
  args: {
    lang: 'en',
    displayName: 'John',
    showAvatar: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify avatar shows single initial
    const avatar = canvas.getByTestId('profile-avatar');
    await expect(avatar).toHaveTextContent('J');
  },
};

/**
 * Long name with multiple parts
 */
export const LongName: Story = {
  args: {
    lang: 'en',
    displayName: 'John Michael Smith',
    showAvatar: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Should show first and last initials
    const avatar = canvas.getByTestId('profile-avatar');
    await expect(avatar).toHaveTextContent('JS');

    // Full name should be visible
    const name = canvas.getByTestId('profile-name');
    await expect(name).toHaveTextContent('John Michael Smith');
  },
};

/**
 * Without avatar
 */
export const NoAvatar: Story = {
  args: {
    lang: 'en',
    displayName: 'Jane Smith',
    showAvatar: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify name is present
    const name = canvas.getByTestId('profile-name');
    await expect(name).toHaveTextContent('Jane Smith');

    // Avatar should not be present
    const avatar = canvas.queryByTestId('profile-avatar');
    await expect(avatar).not.toBeInTheDocument();
  },
};

/**
 * Custom text instead of display name
 */
export const CustomText: Story = {
  args: {
    lang: 'en',
    displayName: 'John Doe',
    showAvatar: true,
    children: 'My Account',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Should show custom text
    const name = canvas.getByTestId('profile-name');
    await expect(name).toHaveTextContent('My Account');

    // Avatar should still show initials from displayName
    const avatar = canvas.getByTestId('profile-avatar');
    await expect(avatar).toHaveTextContent('JD');
  },
};

/**
 * Spanish locale
 */
export const Spanish: Story = {
  args: {
    lang: 'es',
    displayName: 'María García',
    showAvatar: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const link = canvas.getByTestId('profile-link');
    await expect(link).toHaveAttribute('href', '/es/profile');

    const avatar = canvas.getByTestId('profile-avatar');
    await expect(avatar).toHaveTextContent('MG');
  },
};

/**
 * No display name provided
 */
export const NoDisplayName: Story = {
  args: {
    lang: 'en',
    showAvatar: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Should show default text
    const name = canvas.getByTestId('profile-name');
    await expect(name).toHaveTextContent('Profile');

    // Avatar should show question mark
    const avatar = canvas.getByTestId('profile-avatar');
    await expect(avatar).toHaveTextContent('?');
  },
};

/**
 * Click interaction
 */
export const Clickable: Story = {
  args: {
    lang: 'en',
    displayName: 'John Doe',
    showAvatar: true,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const link = canvas.getByTestId('profile-link');

    // Click the link
    await userEvent.click(link);

    // Verify onClick was called
    await expect(args.onClick).toHaveBeenCalled();
  },
};

/**
 * Hover state
 */
export const HoverState: Story = {
  args: {
    lang: 'en',
    displayName: 'John Doe',
    showAvatar: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const link = canvas.getByTestId('profile-link');

    // Hover over the link
    await userEvent.hover(link);

    // Link should still be visible and functional
    await expect(link).toBeInTheDocument();
  },
};

/**
 * Keyboard navigation
 */
export const KeyboardNav: Story = {
  args: {
    lang: 'en',
    displayName: 'John Doe',
    showAvatar: true,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const link = canvas.getByTestId('profile-link');

    // Tab to link
    await userEvent.tab();
    await expect(link).toHaveFocus();

    // Press Enter
    await userEvent.keyboard('{Enter}');

    // Verify onClick was called
    await expect(args.onClick).toHaveBeenCalled();
  },
};

/**
 * Custom CSS class
 */
export const CustomClass: Story = {
  args: {
    lang: 'en',
    displayName: 'John Doe',
    showAvatar: true,
    className: 'custom-profile-link',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const link = canvas.getByTestId('profile-link');
    await expect(link).toHaveClass('custom-profile-link');
  },
};

/**
 * Accessibility check
 */
export const Accessibility: Story = {
  args: {
    lang: 'en',
    displayName: 'John Doe',
    showAvatar: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const link = canvas.getByTestId('profile-link');

    // Verify it's a proper anchor tag
    await expect(link.tagName).toBe('A');

    // Verify it has href
    await expect(link).toHaveAttribute('href');

    // Verify it's focusable
    link.focus();
    await expect(link).toHaveFocus();

    // Verify avatar and name are present
    await expect(canvas.getByTestId('profile-avatar')).toBeInTheDocument();
    await expect(canvas.getByTestId('profile-name')).toBeInTheDocument();
  },
};
