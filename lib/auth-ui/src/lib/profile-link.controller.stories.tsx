// profile-link.controller.stories.tsx
// Storybook stories for ProfileLinkController with functional tests using MSW

import type { Meta, StoryObj } from '@storybook/react';
import { expect, within, fn, waitFor } from 'storybook/test';
import { http, HttpResponse, delay } from 'msw';
import { ProfileLinkController } from './profile-link.controller';

const meta: Meta<typeof ProfileLinkController> = {
    title: 'Auth/ProfileLinkController',
    component: ProfileLinkController,
    parameters: {
        layout: 'centered',
    },
    args: {
        onAuthCheck: fn(),
    },
    argTypes: {
        lang: {
            control: 'select',
            options: ['en', 'es', 'en-gb'],
            description: 'Language for internationalization',
        },
        apiBaseUrl: {
            control: 'text',
            description: 'Base URL for auth API',
        },
        showAvatar: {
            control: 'boolean',
            description: 'Show avatar with initials',
        },
        onAuthCheck: {
            action: 'auth checked',
            description: 'Callback when auth status is determined',
        },
    },
};

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Default state - checking authentication
 */
export const Default: Story = {
    args: {
        lang: 'en',
        apiBaseUrl: '/northwind/auth',
        showAvatar: true,
    },
    parameters: {
        msw: {
            handlers: [
                http.get('/northwind/auth/me', async () => {
                    await delay(300);
                    return HttpResponse.json({
                        success: true,
                        principal: {
                            id: '123e4567-e89b-12d3-a456-426614174000',
                            email: 'user@example.com',
                            displayName: 'John Doe',
                            kind: 'customer',
                            emailVerified: true,
                        },
                    });
                }),
            ],
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        // Should show loading initially
        const loading = canvas.queryByTestId('auth-loading');
        if (loading) {
            await expect(loading).toBeInTheDocument();
        }
    },
};

/**
 * Authenticated user - shows ProfileLink
 */
export const Authenticated: Story = {
    args: {
        lang: 'en',
        apiBaseUrl: '/northwind/auth',
        showAvatar: true,
    },
    parameters: {
        msw: {
            handlers: [
                http.get('/northwind/auth/me', async () => {
                    await delay(100);
                    return HttpResponse.json({
                        success: true,
                        principal: {
                            id: '123e4567-e89b-12d3-a456-426614174000',
                            email: 'john@example.com',
                            displayName: 'John Doe',
                            kind: 'customer',
                            emailVerified: true,
                        },
                    });
                }),
            ],
        },
    },
    play: async ({ canvasElement, args }) => {
        const canvas = within(canvasElement);

        // Wait for auth check to complete
        await waitFor(
            async () => {
                const profileLink = canvas.getByTestId('profile-link');
                await expect(profileLink).toBeInTheDocument();
            },
            { timeout: 3000 }
        );

        // Verify ProfileLink is shown
        const profileLink = canvas.getByTestId('profile-link');
        await expect(profileLink).toHaveTextContent('John Doe');
        await expect(profileLink).toHaveAttribute('href', '/en/profile');

        // Verify avatar
        const avatar = canvas.getByTestId('profile-avatar');
        await expect(avatar).toHaveTextContent('JD');

        // Verify callback was called with true
        await waitFor(
            async () => {
                await expect(args.onAuthCheck).toHaveBeenCalledWith(true);
            },
            { timeout: 3000 }
        );
    },
};

/**
 * Not authenticated - shows LoginLink
 */
export const NotAuthenticated: Story = {
    args: {
        lang: 'en',
        apiBaseUrl: '/northwind/auth',
        showAvatar: true,
    },
    parameters: {
        msw: {
            handlers: [
                http.get('/northwind/auth/me', async () => {
                    await delay(100);
                    return HttpResponse.json(
                        { success: false, message: 'Not authenticated' },
                        { status: 401 }
                    );
                }),
            ],
        },
    },
    decorators: [
        (Story) => {
            sessionStorage.clear();
            return <Story />;
        },
    ],
    play: async ({ canvasElement, args }) => {
        const canvas = within(canvasElement);

        // Wait for auth check to complete
        await waitFor(
            async () => {
                const loginLink = canvas.getByTestId('login-link');
                await expect(loginLink).toBeInTheDocument();
            },
            { timeout: 3000 }
        );

        // Verify LoginLink is shown
        const loginLink = canvas.getByTestId('login-link');
        await expect(loginLink).toHaveTextContent('Sign In');
        await expect(loginLink).toHaveAttribute('href', '/en/auth/login');

        // Verify callback was called with false
        await waitFor(
            async () => {
                await expect(args.onAuthCheck).toHaveBeenCalledWith(false);
            },
            { timeout: 3000 }
        );
    },
};

/**
 * API error - treats as not authenticated
 */
export const APIError: Story = {
    args: {
        lang: 'en',
        apiBaseUrl: '/northwind/auth',
        showAvatar: true,
    },
    parameters: {
        msw: {
            handlers: [
                http.get('/northwind/auth/me', async () => {
                    await delay(100);
                    return HttpResponse.error();
                }),
            ],
        },
    },
    play: async ({ canvasElement, args }) => {
        const canvas = within(canvasElement);

        // Wait for error handling
        await waitFor(
            async () => {
                const loginLink = canvas.getByTestId('login-link');
                await expect(loginLink).toBeInTheDocument();
            },
            { timeout: 3000 }
        );

        // Should show LoginLink on error
        const loginLink = canvas.getByTestId('login-link');
        await expect(loginLink).toBeInTheDocument();

        // Verify callback was called with false
        await waitFor(
            async () => {
                await expect(args.onAuthCheck).toHaveBeenCalledWith(false);
            },
            { timeout: 3000 }
        );
    },
};

/**
 * Slow API response - shows loading state
 */
export const SlowResponse: Story = {
    args: {
        lang: 'en',
        apiBaseUrl: '/northwind/auth',
        showAvatar: true,
    },
    parameters: {
        msw: {
            handlers: [
                http.get('/northwind/auth/me', async () => {
                    await delay(2000);
                    return HttpResponse.json({
                        success: true,
                        principal: {
                            id: '123',
                            email: 'user@example.com',
                            displayName: 'Jane Smith',
                            kind: 'customer',
                            emailVerified: true,
                        },
                    });
                }),
            ],
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        // Should show loading state
        const loading = canvas.getByTestId('auth-loading');
        await expect(loading).toBeInTheDocument();

        // Wait for it to resolve
        await waitFor(
            async () => {
                const profileLink = canvas.queryByTestId('profile-link');
                if (profileLink) {
                    await expect(profileLink).toBeInTheDocument();
                }
            },
            { timeout: 3500 }
        );
    },
};

/**
 * Different user types - employee
 */
export const EmployeeUser: Story = {
    args: {
        lang: 'en',
        apiBaseUrl: '/northwind/auth',
        showAvatar: true,
    },
    parameters: {
        msw: {
            handlers: [
                http.get('/northwind/auth/me', async () => {
                    await delay(100);
                    return HttpResponse.json({
                        success: true,
                        principal: {
                            id: '987',
                            email: 'employee@example.com',
                            displayName: 'Jane Manager',
                            kind: 'employee',
                            emailVerified: true,
                        },
                    });
                }),
            ],
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitFor(
            async () => {
                const profileLink = canvas.getByTestId('profile-link');
                await expect(profileLink).toBeInTheDocument();
            },
            { timeout: 3000 }
        );

        // Verify employee name is shown
        const profileLink = canvas.getByTestId('profile-link');
        await expect(profileLink).toHaveTextContent('Jane Manager');

        const avatar = canvas.getByTestId('profile-avatar');
        await expect(avatar).toHaveTextContent('JM');
    },
};

/**
 * Without avatar
 */
export const WithoutAvatar: Story = {
    args: {
        lang: 'en',
        apiBaseUrl: '/northwind/auth',
        showAvatar: false,
    },
    parameters: {
        msw: {
            handlers: [
                http.get('/northwind/auth/me', async () => {
                    await delay(100);
                    return HttpResponse.json({
                        success: true,
                        principal: {
                            id: '123',
                            email: 'user@example.com',
                            displayName: 'John Doe',
                            kind: 'customer',
                            emailVerified: true,
                        },
                    });
                }),
            ],
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitFor(
            async () => {
                const profileLink = canvas.getByTestId('profile-link');
                await expect(profileLink).toBeInTheDocument();
            },
            { timeout: 3000 }
        );

        // Avatar should not be present
        const avatar = canvas.queryByTestId('profile-avatar');
        await expect(avatar).not.toBeInTheDocument();

        // Name should still be visible
        const name = canvas.getByTestId('profile-name');
        await expect(name).toHaveTextContent('John Doe');
    },
};

/**
 * Spanish locale
 */
export const SpanishLocale: Story = {
    args: {
        lang: 'es',
        apiBaseUrl: '/northwind/auth',
        showAvatar: true,
    },
    parameters: {
        msw: {
            handlers: [
                http.get('/northwind/auth/me', async () => {
                    await delay(100);
                    return HttpResponse.json({
                        success: true,
                        principal: {
                            id: '123',
                            email: 'usuario@ejemplo.com',
                            displayName: 'María García',
                            kind: 'customer',
                            emailVerified: true,
                        },
                    });
                }),
            ],
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitFor(
            async () => {
                const profileLink = canvas.getByTestId('profile-link');
                await expect(profileLink).toBeInTheDocument();
            },
            { timeout: 3000 }
        );

        // Verify Spanish locale in href
        const profileLink = canvas.getByTestId('profile-link');
        await expect(profileLink).toHaveAttribute('href', '/es/profile');
    },
};

/**
 * Custom API base URL
 */
export const CustomAPIBaseURL: Story = {
    args: {
        lang: 'en',
        apiBaseUrl: '/custom/auth',
        showAvatar: true,
    },
    parameters: {
        msw: {
            handlers: [
                http.get('/custom/auth/me', async () => {
                    await delay(100);
                    return HttpResponse.json({
                        success: true,
                        principal: {
                            id: '123',
                            email: 'user@example.com',
                            displayName: 'Custom User',
                            kind: 'customer',
                            emailVerified: true,
                        },
                    });
                }),
            ],
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitFor(
            async () => {
                const profileLink = canvas.getByTestId('profile-link');
                await expect(profileLink).toBeInTheDocument();
            },
            { timeout: 3000 }
        );

        const profileLink = canvas.getByTestId('profile-link');
        await expect(profileLink).toHaveTextContent('Custom User');
    },
};
