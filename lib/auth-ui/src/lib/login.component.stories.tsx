// login.component.stories.tsx
// Storybook stories for LoginComponent with functional tests

import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within, fn } from 'storybook/test';
import { LoginComponent } from './login.component';

const meta: Meta<typeof LoginComponent> = {
  title: 'Auth/LoginComponent',
  component: LoginComponent,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    onSubmit: fn(),
    onClearError: fn(),
  },
  argTypes: {
    isLoading: {
      control: 'boolean',
      description: 'Loading state during form submission',
    },
    error: {
      control: 'text',
      description: 'Error message to display',
    },
    onSubmit: {
      action: 'submitted',
      description: 'Callback when form is submitted',
    },
    onClearError: {
      action: 'error cleared',
      description: 'Callback when error is cleared',
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Default state - empty form ready for input
 */
export const Default: Story = {
  args: {
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Verify all form elements are present
    const heading = canvas.getByText('Sign In');
    await expect(heading).toBeInTheDocument();

    const emailInput = canvas.getByLabelText(/email address/i);
    await expect(emailInput).toBeInTheDocument();
    await expect(emailInput).toBeEnabled();

    const passwordInput = canvas.getByLabelText(/^password$/i);
    await expect(passwordInput).toBeInTheDocument();
    await expect(passwordInput).toBeEnabled();

    const submitButton = canvas.getByRole('button', { name: /sign in/i });
    await expect(submitButton).toBeInTheDocument();
    await expect(submitButton).toBeDisabled(); // Disabled when empty

    const forgotLink = canvas.getByText(/forgot your password/i);
    await expect(forgotLink).toBeInTheDocument();
  },
};

/**
 * Loading state - form is submitting
 */
export const Loading: Story = {
  args: {
    isLoading: true,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify loading state
    const submitButton = canvas.getByRole('button', { name: /signing in/i });
    await expect(submitButton).toBeInTheDocument();
    await expect(submitButton).toBeDisabled();

    // Verify inputs are disabled
    const emailInput = canvas.getByLabelText(/email address/i);
    await expect(emailInput).toBeDisabled();

    const passwordInput = canvas.getByLabelText(/^password$/i);
    await expect(passwordInput).toBeDisabled();

    // Verify spinner is visible
    const spinner = canvas.getByText(/signing in/i);
    await expect(spinner).toBeInTheDocument();
  },
};

/**
 * Error state - shows error message
 */
export const WithError: Story = {
  args: {
    isLoading: false,
    error: 'Invalid credentials. Please check your email and password.',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Verify error message is displayed
    const errorMessage = canvas.getByRole('alert');
    await expect(errorMessage).toBeInTheDocument();
    await expect(errorMessage).toHaveTextContent(args.error as string);

    // Verify form is still functional
    const emailInput = canvas.getByLabelText(/email address/i);
    await expect(emailInput).toBeEnabled();

    const passwordInput = canvas.getByLabelText(/^password$/i);
    await expect(passwordInput).toBeEnabled();
  },
};

/**
 * Form interaction - user fills out and submits form
 */
export const FormInteraction: Story = {
  args: {
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Get form elements
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);
    const submitButton = canvas.getByRole('button', { name: /sign in/i });

    // Initially submit button should be disabled
    await expect(submitButton).toBeDisabled();

    // Fill in email
    await userEvent.type(emailInput, 'user@example.com');
    await expect(emailInput).toHaveValue('user@example.com');

    // Still disabled without password
    await expect(submitButton).toBeDisabled();

    // Fill in password
    await userEvent.type(passwordInput, 'password123');
    await expect(passwordInput).toHaveValue('password123');

    // Now submit button should be enabled
    await expect(submitButton).toBeEnabled();

    // Submit form
    await userEvent.click(submitButton);

    // Verify onSubmit was called with correct data
    await expect(args.onSubmit).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });
  },
};

/**
 * Password visibility toggle
 */
export const PasswordToggle: Story = {
  args: {
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const passwordInput = canvas.getByLabelText(/^password$/i);
    const toggleButton = canvas.getByRole('button', { name: /show password/i });

    // Initially password should be hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Type password
    await userEvent.type(passwordInput, 'secret123');

    // Click toggle to show password
    await userEvent.click(toggleButton);
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click again to hide
    const hideButton = canvas.getByRole('button', { name: /hide password/i });
    await userEvent.click(hideButton);
    await expect(passwordInput).toHaveAttribute('type', 'password');
  },
};

/**
 * Error cleared on input - error disappears when user types
 */
export const ErrorClearedOnInput: Story = {
  args: {
    isLoading: false,
    error: 'Invalid credentials',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Verify error is displayed
    const errorMessage = canvas.getByRole('alert');
    await expect(errorMessage).toBeInTheDocument();

    // Type in email input
    const emailInput = canvas.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 't');

    // Verify onClearError was called
    await expect(args.onClearError).toHaveBeenCalled();
  },
};

/**
 * Network error - shows long error message
 */
export const NetworkError: Story = {
  args: {
    isLoading: false,
    error: 'Network error: Unable to connect to the authentication server. Please check your internet connection and try again.',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Verify long error message is displayed properly
    const errorMessage = canvas.getByRole('alert');
    await expect(errorMessage).toBeInTheDocument();
    await expect(errorMessage).toHaveTextContent(args.error as string);
  },
};

/**
 * Form validation - empty submission blocked
 */
export const EmptyFormValidation: Story = {
  args: {
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const submitButton = canvas.getByRole('button', { name: /sign in/i });

    // Submit button should be disabled when form is empty
    await expect(submitButton).toBeDisabled();

    // Try to click (shouldn't trigger submission)
    // Note: clicking a disabled button doesn't trigger events
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/**
 * Partial form - only email filled
 */
export const PartialFormEmail: Story = {
  args: {
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const emailInput = canvas.getByLabelText(/email address/i);
    const submitButton = canvas.getByRole('button', { name: /sign in/i });

    // Fill only email
    await userEvent.type(emailInput, 'user@example.com');

    // Submit should still be disabled
    await expect(submitButton).toBeDisabled();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/**
 * Partial form - only password filled
 */
export const PartialFormPassword: Story = {
  args: {
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const passwordInput = canvas.getByLabelText(/^password$/i);
    const submitButton = canvas.getByRole('button', { name: /sign in/i });

    // Fill only password
    await userEvent.type(passwordInput, 'password123');

    // Submit should still be disabled
    await expect(submitButton).toBeDisabled();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/**
 * Accessibility - keyboard navigation
 */
export const KeyboardNavigation: Story = {
  args: {
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    // Tab to email input
    await userEvent.tab();
    await expect(emailInput).toHaveFocus();

    // Type email
    await userEvent.keyboard('user@example.com');

    // Tab to password input
    await userEvent.tab();
    await expect(passwordInput).toHaveFocus();

    // Type password
    await userEvent.keyboard('password123');

    // Tab to password toggle button
    await userEvent.tab();

    // Tab to submit button
    await userEvent.tab();
    const submitButton = canvas.getByRole('button', { name: /sign in/i });
    await expect(submitButton).toHaveFocus();

    // Press Enter to submit
    await userEvent.keyboard('{Enter}');

    // Verify form was submitted
    await expect(args.onSubmit).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });
  },
};
