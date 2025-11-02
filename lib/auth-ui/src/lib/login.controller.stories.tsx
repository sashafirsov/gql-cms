// login.controller.stories.tsx
// Storybook stories for LoginController with integration tests

import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, fn, waitFor } from 'storybook/test';
import { LoginController } from './login.controller';

const meta: Meta<typeof LoginController> = {
  title: 'Auth/LoginController',
  component: LoginController,
  parameters: {
    layout: 'fullscreen',
    // Mock fetch for API calls
    mockData: [
      {
        url: '/northwind/auth/login',
        method: 'POST',
        status: 200,
        response: {
          success: true,
          message: 'Login successful',
          principal: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'user@example.com',
            kind: 'customer',
            displayName: 'John Doe',
            emailVerified: true,
          },
        },
      },
    ],
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
    mockData: [
      {
        url: '/northwind/auth/login',
        method: 'POST',
        status: 200,
        response: {
          success: true,
          message: 'Login successful',
          principal: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'user@example.com',
            kind: 'customer',
            displayName: 'John Doe',
            emailVerified: true,
          },
        },
      },
    ],
  },
  play: async ({ canvasElement, args }) => {
    // Mock fetch globally for this story
    const originalFetch = global.fetch;
    global.fetch = fn(async (url: string, options?: any) => {
      if (url.includes('/login')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            message: 'Login successful',
            principal: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              email: 'user@example.com',
              kind: 'customer',
              displayName: 'John Doe',
              emailVerified: true,
            },
          }),
        } as Response;
      }
      return originalFetch(url, options);
    }) as typeof fetch;

    const canvas = within(canvasElement);

    // Fill in the form
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.type(passwordInput, 'Password123!');

    // Submit the form
    const submitButton = canvas.getByRole('button', { name: /sign in/i });
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
        await expect(args.onLoginSuccess).toHaveBeenCalledWith({
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'user@example.com',
          kind: 'customer',
          displayName: 'John Doe',
          emailVerified: true,
        });
      },
      { timeout: 3000 }
    );

    // Restore original fetch
    global.fetch = originalFetch;
  },
};

/**
 * Failed login - invalid credentials
 */
export const InvalidCredentials: Story = {
  play: async ({ canvasElement, args }) => {
    // Mock fetch to return error
    const originalFetch = global.fetch;
    global.fetch = fn(async (url: string) => {
      if (url.includes('/login')) {
        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({
            success: false,
            message: 'Invalid credentials',
          }),
        } as Response;
      }
      return originalFetch(url);
    }) as typeof fetch;

    const canvas = within(canvasElement);

    // Fill in the form
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.type(passwordInput, 'wrongpassword');

    // Submit the form
    const submitButton = canvas.getByRole('button', { name: /sign in/i });
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

    // Restore original fetch
    global.fetch = originalFetch;
  },
};

/**
 * Email validation error
 */
export const InvalidEmailFormat: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Fill in invalid email
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'not-an-email');
    await userEvent.type(passwordInput, 'password123');

    // Submit the form
    const submitButton = canvas.getByRole('button', { name: /sign in/i });
    await userEvent.click(submitButton);

    // Wait for validation error
    await waitFor(
      async () => {
        const errorMessage = canvas.getByRole('alert');
        await expect(errorMessage).toBeInTheDocument();
        await expect(errorMessage).toHaveTextContent(/valid email/i);
      },
      { timeout: 3000 }
    );

    // Verify error callback was called with validation message
    await waitFor(
      async () => {
        await expect(args.onLoginError).toHaveBeenCalledWith(
          expect.stringContaining('valid email')
        );
      },
      { timeout: 3000 }
    );
  },
};

/**
 * Empty form submission
 */
export const EmptyFormSubmission: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Try to submit without filling anything
    const submitButton = canvas.getByRole('button', { name: /sign in/i });

    // Button should be disabled, so can't actually click
    await expect(submitButton).toBeDisabled();
  },
};

/**
 * Network error - server unreachable
 */
export const NetworkError: Story = {
  play: async ({ canvasElement, args }) => {
    // Mock fetch to throw network error
    const originalFetch = global.fetch;
    global.fetch = fn(async (url: string) => {
      if (url.includes('/login')) {
        throw new Error('Network error: Failed to fetch');
      }
      return originalFetch(url);
    }) as typeof fetch;

    const canvas = within(canvasElement);

    // Fill in the form
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.type(passwordInput, 'password123');

    // Submit the form
    const submitButton = canvas.getByRole('button', { name: /sign in/i });
    await userEvent.click(submitButton);

    // Wait for error to appear
    await waitFor(
      async () => {
        const errorMessage = canvas.getByRole('alert');
        await expect(errorMessage).toBeInTheDocument();
        await expect(errorMessage).toHaveTextContent(/network error/i);
      },
      { timeout: 3000 }
    );

    // Restore original fetch
    global.fetch = originalFetch;
  },
};

/**
 * Server error - 500 response
 */
export const ServerError: Story = {
  play: async ({ canvasElement, args }) => {
    // Mock fetch to return server error
    const originalFetch = global.fetch;
    global.fetch = fn(async (url: string) => {
      if (url.includes('/login')) {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({
            success: false,
            message: 'Internal server error',
          }),
        } as Response;
      }
      return originalFetch(url);
    }) as typeof fetch;

    const canvas = within(canvasElement);

    // Fill in the form
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.type(passwordInput, 'password123');

    // Submit the form
    const submitButton = canvas.getByRole('button', { name: /sign in/i });
    await userEvent.click(submitButton);

    // Wait for error to appear
    await waitFor(
      async () => {
        const errorMessage = canvas.getByRole('alert');
        await expect(errorMessage).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Restore original fetch
    global.fetch = originalFetch;
  },
};

/**
 * Retry after error - user corrects mistake
 */
export const RetryAfterError: Story = {
  play: async ({ canvasElement, args }) => {
    // Mock fetch - first call fails, second succeeds
    let callCount = 0;
    const originalFetch = global.fetch;
    global.fetch = fn(async (url: string) => {
      if (url.includes('/login')) {
        callCount++;
        if (callCount === 1) {
          // First attempt fails
          return {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: async () => ({
              success: false,
              message: 'Invalid credentials',
            }),
          } as Response;
        } else {
          // Second attempt succeeds
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              message: 'Login successful',
              principal: {
                id: '123e4567-e89b-12d3-a456-426614174000',
                email: 'user@example.com',
                kind: 'customer',
                displayName: 'John Doe',
                emailVerified: true,
              },
            }),
          } as Response;
        }
      }
      return originalFetch(url);
    }) as typeof fetch;

    const canvas = within(canvasElement);

    // First attempt with wrong password
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.type(passwordInput, 'wrongpassword');

    const submitButton = canvas.getByRole('button', { name: /sign in/i });
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

    // Restore original fetch
    global.fetch = originalFetch;
  },
};

/**
 * Custom API base URL
 */
export const CustomApiBaseUrl: Story = {
  args: {
    apiBaseUrl: '/custom/auth',
  },
  play: async ({ canvasElement, args }) => {
    // Mock fetch to verify correct URL is called
    const originalFetch = global.fetch;
    const mockFetch = fn(async (url: string) => {
      // Verify custom base URL is used
      if (url === '/custom/auth/login') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            message: 'Login successful',
            principal: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              email: 'user@example.com',
              kind: 'customer',
              displayName: 'John Doe',
              emailVerified: true,
            },
          }),
        } as Response;
      }
      return originalFetch(url);
    }) as typeof fetch;
    global.fetch = mockFetch;

    const canvas = within(canvasElement);

    // Fill and submit form
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.type(passwordInput, 'password123');

    const submitButton = canvas.getByRole('button', { name: /sign in/i });
    await userEvent.click(submitButton);

    // Wait for API call and verify URL
    await waitFor(
      async () => {
        await expect(mockFetch).toHaveBeenCalledWith(
          '/custom/auth/login',
          expect.objectContaining({
            method: 'POST',
            credentials: 'include',
          })
        );
      },
      { timeout: 3000 }
    );

    // Restore original fetch
    global.fetch = originalFetch;
  },
};

/**
 * Verify credentials are included in request
 */
export const VerifyCredentialsIncluded: Story = {
  play: async ({ canvasElement }) => {
    // Mock fetch to verify credentials option
    const originalFetch = global.fetch;
    const mockFetch = fn(async (url: string, options?: any) => {
      if (url.includes('/login')) {
        // Verify credentials: 'include' is set
        if (options?.credentials !== 'include') {
          throw new Error('Credentials not included in request');
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            principal: {
              id: '123',
              email: 'user@example.com',
              kind: 'customer',
              displayName: 'Test User',
              emailVerified: true,
            },
          }),
        } as Response;
      }
      return originalFetch(url, options);
    }) as typeof fetch;
    global.fetch = mockFetch;

    const canvas = within(canvasElement);

    // Fill and submit form
    const emailInput = canvas.getByLabelText(/email address/i);
    const passwordInput = canvas.getByLabelText(/^password$/i);

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.type(passwordInput, 'password123');

    const submitButton = canvas.getByRole('button', { name: /sign in/i });
    await userEvent.click(submitButton);

    // Verify fetch was called with correct options
    await waitFor(
      async () => {
        await expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/login'),
          expect.objectContaining({
            method: 'POST',
            credentials: 'include',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
            body: expect.any(String),
          })
        );
      },
      { timeout: 3000 }
    );

    // Restore original fetch
    global.fetch = originalFetch;
  },
};
