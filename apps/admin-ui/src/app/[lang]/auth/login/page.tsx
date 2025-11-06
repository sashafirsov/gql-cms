'use client';

import { useRouter } from 'next/navigation';
import { LoginController } from '@auth-ui';
import type { LoginSuccessData } from '@auth-ui';
import styles from '@/app/[lang]/auth/auth-page.module.css';

/**
 * Login Page
 *
 * User login with email and password
 * Redirects to dashboard on success
 */
export default function LoginPage() {
  const router = useRouter();

  const handleLoginSuccess = (principal: LoginSuccessData) => {
    console.log('Login successful:', principal);

    // Store user info if needed
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('user', JSON.stringify(principal));
    }

    // Redirect to dashboard
    router.push('/en/dashboard');
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
