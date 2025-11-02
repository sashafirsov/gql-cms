// login.controller.tsx
// Controller with business logic for login flow

'use client';

import { useState, useCallback } from 'react';
import { LoginComponent } from './login.component';

export interface LoginControllerProps {
  onLoginSuccess?: (principal: LoginSuccessData) => void;
  onLoginError?: (error: string) => void;
  apiBaseUrl?: string;
}

export interface LoginSuccessData {
  id: string;
  email: string;
  kind: string;
  displayName: string;
  emailVerified: boolean;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  principal?: LoginSuccessData;
}

export function LoginController({
  onLoginSuccess,
  onLoginError,
  apiBaseUrl = '/northwind/auth',
}: LoginControllerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (formData: LoginFormData) => {
      setIsLoading(true);
      setError(null);

      try {
        // Validate form data
        if (!formData.email || !formData.password) {
          throw new Error('Email and password are required');
        }

        if (!isValidEmail(formData.email)) {
          throw new Error('Please enter a valid email address');
        }

        // Make API call
        const response = await fetch(`${apiBaseUrl}/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Important: include cookies
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        });

        if (!response.ok) {
          const errorData = (await response
            .json()
            .catch(() => ({}))) as Partial<LoginResponse>;
          throw new Error(
            errorData.message || `Login failed: ${response.statusText}`
          );
        }

        const data = (await response.json()) as LoginResponse;

        if (!data.success) {
          throw new Error(data.message || 'Login failed');
        }

        // Success callback
        if (onLoginSuccess && data.principal) {
          onLoginSuccess(data.principal);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(errorMessage);

        // Error callback
        if (onLoginError) {
          onLoginError(errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, onLoginSuccess, onLoginError]
  );

  const handleClearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <LoginComponent
      onSubmit={handleSubmit}
      isLoading={isLoading}
      error={error}
      onClearError={handleClearError}
    />
  );
}

// Helper function to validate email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default LoginController;
