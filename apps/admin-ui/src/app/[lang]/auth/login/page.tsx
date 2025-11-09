'use client';

import { LoginController } from '@auth-ui';
import type { LoginSuccessData } from '@auth-ui';

/**
 * Login Page
 *
 * User login with email and password
 * Redirects to dashboard on success
 */
export default function LoginPage() {

    const handleLoginSuccess = (principal: LoginSuccessData) => {
        console.log('Login successful:', principal);

        // Store user info if needed
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('user', JSON.stringify(principal));
        }

        // Redirect to dashboard
        // @ts-expect-error for now
        window.location = '/en/dashboard';
    };

    const handleLoginError = (error: string) => {
        console.error('Login failed:', error);
        // Error is already displayed by the component
    };

    return (
        <LoginController
            apiBaseUrl="/northwind/auth"
            onLoginSuccess={handleLoginSuccess}
            onLoginError={handleLoginError}
        />
    );
}
