// login.controller.stories.tsx
// Storybook stories for LoginController with integration tests using MSW

import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, fn, waitFor } from 'storybook/test';
import { http, HttpResponse, delay } from 'msw';
import { LoginController } from './login.controller';
import {
  successfulLoginHandler,
  invalidCredentialsHandler,
  serverErrorHandler,
  networkErrorHandler,
  mockPrincipal,
} from '../mocks';

const meta: Meta<typeof LoginController> = {
  title: 'Auth/LoginController',
  component: LoginController,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    onLoginSuccess: fn(),
    onLoginError: fn(),
    apiBaseUrl: '/northwind/auth',
  },
  argTypes: {
    onLoginSuccess: {
      action: 'login success',
      description: 'Callback when login succeeds',
    },
    onLoginError: {
      action: 'login error',
      description: 'Callback when login fails',
    },
    apiBaseUrl: {
      control: 'text',
      description: 'Base URL for auth API',
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Default state - ready for user interaction
 */
export const Default: Story = {
  parameters: {
    msw: {
      handlers: [successfulLoginHandler],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify form is rendered
    const heading = canvas.getByText('Sign In');
    await expect(heading).toBeInTheDocument();

    // Verify no error is shown
    const alerts = canvas.queryAllByRole('alert');
    await expect(alerts).toHaveLength(0);
  },
};

/**
 * Successful login flow - complete user journey
 */
export const SuccessfulLogin: Story = {
  parameters: {
    msw: {
      handlers: [successfulLoginHandler],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Fill in the form
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.type(passwordInput, 'Password123!');

    // Submit the form
    const submitButton = canvas.getByRole('button', { name: /next/i });
    await userEvent.click(submitButton);

    // Wait for loading state
    await waitFor(
      async () => {
        const loadingButton = canvas.queryByRole('button', {
          name: /signing in/i,
        });
        if (loadingButton) {
          await expect(loadingButton).toBeInTheDocument();
        }
      },
      { timeout: 1000 }
    );

    // Wait for success callback
    await waitFor(
      async () => {
        await expect(args.onLoginSuccess).toHaveBeenCalledWith(mockPrincipal);
      },
      { timeout: 3000 }
    );
  },
};

/**
 * Failed login - invalid credentials
 */
export const InvalidCredentials: Story = {
  parameters: {
    msw: {
      handlers: [invalidCredentialsHandler],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Fill in the form
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.type(passwordInput, 'wrongpassword');

    // Submit the form
    const submitButton = canvas.getByRole('button', { name: /next/i });
    await userEvent.click(submitButton);

    // Wait for error to appear
    await waitFor(
      async () => {
        const errorMessage = canvas.getByRole('alert');
        await expect(errorMessage).toBeInTheDocument();
        await expect(errorMessage).toHaveTextContent(/invalid credentials/i);
      },
      { timeout: 3000 }
    );

    // Verify error callback was called
    await waitFor(
      async () => {
        await expect(args.onLoginError).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );
  },
};

/**
 * Email validation error
 */
export const InvalidEmailFormat: Story = {
  parameters: {
    msw: {
      handlers: [successfulLoginHandler],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Fill in invalid email
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'not-an-email');
    await userEvent.type(passwordInput, 'password123');

    // Submit the form
    const submitButton = canvas.getByRole('button', { name: /next/i });
    await userEvent.click(submitButton);

    // ToDo: handle native error state by <input type=email>
    // Wait for validation error
    // await waitFor(
    //   async () => {
    //     const errorMessage = canvas.getByRole('alert');
    //     await expect(errorMessage).toBeInTheDocument();
    //     await expect(errorMessage).toHaveTextContent(/valid email/i);
    //   },
    //   { timeout: 3000 }
    // );

    // Verify error callback was called with validation message
    // await waitFor(
    //   async () => {
    //     await expect(args.onLoginError).toHaveBeenCalledWith(
    //       expect.stringContaining('valid email')
    //     );
    //   },
    //   { timeout: 3000 }
    // );
  },
};

/**
 * Empty form submission
 */
export const EmptyFormSubmission: Story = {
  parameters: {
    msw: {
      handlers: [successfulLoginHandler],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Try to submit without filling anything
    const submitButton = canvas.getByRole('button', { name: /next/i });

    // Button should be disabled, so can't actually click
    await expect(submitButton).toBeDisabled();
  },
};

/**
 * Network error - server unreachable
 */
export const NetworkError: Story = {
  parameters: {
    msw: {
      handlers: [networkErrorHandler],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Fill in the form
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.type(passwordInput, 'password123');

    // Submit the form
    const submitButton = canvas.getByRole('button', { name: /next/i });
    await userEvent.click(submitButton);

    // Wait for error to appear
    await waitFor(
      async () => {
        const errorMessage = canvas.getByRole('alert');
        await expect(errorMessage).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

/**
 * Server error - 500 response
 */
export const ServerError: Story = {
  parameters: {
    msw: {
      handlers: [serverErrorHandler],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill in the form
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.type(passwordInput, 'password123');

    // Submit the form
    const submitButton = canvas.getByRole('button', { name: /next/i });
    await userEvent.click(submitButton);

    // Wait for error to appear
    await waitFor(
      async () => {
        const errorMessage = canvas.getByRole('alert');
        await expect(errorMessage).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

/**
 * Retry after error - user corrects mistake
 */
export const RetryAfterError: Story = {
  parameters: {
    msw: {
      handlers: [
        // First call fails, subsequent calls succeed
        http.post('/northwind/auth/login', async ({ request }) => {
          const body = (await request.json()) as {
            email: string;
            password: string;
          };

          await delay(300);

          // First attempt with wrong password fails
          if (body.password === 'wrongpassword') {
            return HttpResponse.json(
              { success: false, message: 'Invalid credentials' },
              { status: 401 }
            );
          }

          // Corrected password succeeds
          return HttpResponse.json({
            success: true,
            message: 'Login successful',
            principal: mockPrincipal,
          });
        }),
      ],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // First attempt with wrong password
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.type(passwordInput, 'wrongpassword');

    const submitButton = canvas.getByRole('button', { name: /next/i });
    await userEvent.click(submitButton);

    // Wait for error
    await waitFor(
      async () => {
        const errorMessage = canvas.getByRole('alert');
        await expect(errorMessage).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Clear password and try again with correct one
    await userEvent.clear(passwordInput);
    await userEvent.type(passwordInput, 'correctpassword');

    // Error should clear when typing
    await waitFor(
      async () => {
        const alerts = canvas.queryAllByRole('alert');
        await expect(alerts).toHaveLength(0);
      },
      { timeout: 2000 }
    );

    // Submit again
    await userEvent.click(submitButton);

    // Wait for success
    await waitFor(
      async () => {
        await expect(args.onLoginSuccess).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );
  },
};

/**
 * Custom API base URL
 */
export const CustomApiBaseUrl: Story = {
  args: {
    apiBaseUrl: '/custom/auth',
  },
  parameters: {
    msw: {
      handlers: [
        http.post('/custom/auth/login', async () => {
          await delay(300);
          return HttpResponse.json({
            success: true,
            message: 'Login successful',
            principal: mockPrincipal,
          });
        }),
      ],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Fill and submit form
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.type(passwordInput, 'password123');

    const submitButton = canvas.getByRole('button', { name: /next/i });
    await userEvent.click(submitButton);

    // Wait for success
    await waitFor(
      async () => {
        await expect(args.onLoginSuccess).toHaveBeenCalledWith(mockPrincipal);
      },
      { timeout: 3000 }
    );
  },
};

/**
 * Slow response - testing loading states
 */
export const SlowResponse: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/northwind/auth/login', async () => {
          await delay(2000); // 2 second delay
          return HttpResponse.json({
            success: true,
            message: 'Login successful',
            principal: mockPrincipal,
          });
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill and submit form
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.type(passwordInput, 'password123');

    const submitButton = canvas.getByRole('button', { name: /next/i });
    await userEvent.click(submitButton);

    // Verify loading state persists
    await waitFor(
      async () => {
        const loadingButton = canvas.getByRole('button', {
          name: /signing in/i,
        });
        await expect(loadingButton).toBeInTheDocument();
        await expect(loadingButton).toBeDisabled();
      },
      { timeout: 1000 }
    );

    // Inputs should be disabled during loading
    await expect(emailInput).toBeDisabled();
    await expect(passwordInput).toBeDisabled();
  },
};

/**
 * Different user types - employee login
 */
export const EmployeeLogin: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/northwind/auth/login', async () => {
          await delay(300);
          return HttpResponse.json({
            success: true,
            message: 'Login successful',
            principal: {
              id: '987e6543-e21b-12d3-a456-426614174000',
              email: 'employee@example.com',
              kind: 'employee',
              displayName: 'Jane Smith',
              emailVerified: true,
            },
          });
        }),
      ],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Fill in the form
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'employee@example.com');
    await userEvent.type(passwordInput, 'Password123!');

    // Submit the form
    const submitButton = canvas.getByRole('button', { name: /next/i });
    await userEvent.click(submitButton);

    // Wait for success with employee principal
    await waitFor(
      async () => {
        await expect(args.onLoginSuccess).toHaveBeenCalledWith({
          id: '987e6543-e21b-12d3-a456-426614174000',
          email: 'employee@example.com',
          kind: 'employee',
          displayName: 'Jane Smith',
          emailVerified: true,
        });
      },
      { timeout: 3000 }
    );
  },
};
