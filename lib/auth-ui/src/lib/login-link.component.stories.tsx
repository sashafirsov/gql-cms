// login-link.component.stories.tsx
// Storybook stories for LoginLink component with functional tests

import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within, fn } from 'storybook/test';
import { LoginLink } from './login-link.component';

const meta: Meta<typeof LoginLink> = {
  title: 'Auth/LoginLink',
  component: LoginLink,
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
    className: {
      control: 'text',
      description: 'Custom CSS class',
    },
    children: {
      control: 'text',
      description: 'Link text',
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
 * Default state - English locale
 */
export const Default: Story = {
  args: {
    lang: 'en',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify link is present
    const link = canvas.getByTestId('login-link');
    await expect(link).toBeInTheDocument();
    await expect(link).toHaveTextContent('Sign In');

    // Verify href
    await expect(link).toHaveAttribute('href', '/en/auth/login');
  },
};

/**
 * Custom text
 */
export const CustomText: Story = {
  args: {
    lang: 'en',
    children: 'Log In',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const link = canvas.getByTestId('login-link');
    await expect(link).toHaveTextContent('Log In');
  },
};

/**
 * Spanish locale
 */
export const Spanish: Story = {
  args: {
    lang: 'es',
    children: 'Iniciar Sesión',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const link = canvas.getByTestId('login-link');
    await expect(link).toHaveAttribute('href', '/es/auth/login');
    await expect(link).toHaveTextContent('Iniciar Sesión');
  },
};

/**
 * British English locale
 */
export const BritishEnglish: Story = {
  args: {
    lang: 'en-gb',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const link = canvas.getByTestId('login-link');
    await expect(link).toHaveAttribute('href', '/en-gb/auth/login');
  },
};

/**
 * Custom CSS class
 */
export const CustomClass: Story = {
  args: {
    lang: 'en',
    className: 'custom-login-link',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const link = canvas.getByTestId('login-link');
    await expect(link).toHaveClass('custom-login-link');
  },
};

/**
 * Click interaction
 */
export const Clickable: Story = {
  args: {
    lang: 'en',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const link = canvas.getByTestId('login-link');

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
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const link = canvas.getByTestId('login-link');

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
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const link = canvas.getByTestId('login-link');

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
 * Accessibility check
 */
export const Accessibility: Story = {
  args: {
    lang: 'en',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const link = canvas.getByTestId('login-link');

    // Verify it's a proper anchor tag
    await expect(link.tagName).toBe('A');

    // Verify it has href
    await expect(link).toHaveAttribute('href');

    // Verify it's focusable
    link.focus();
    await expect(link).toHaveFocus();
  },
};
