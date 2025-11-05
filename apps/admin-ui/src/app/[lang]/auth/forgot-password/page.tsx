'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../auth-page.module.css';

/**
 * Forgot Password Page
 *
 * User can request a password reset email
 *
 * TODO: Implement password reset flow in backend
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email) {
      setError('Email is required');
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Implement forgot password API endpoint
      // For now, simulate success
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/en/auth/login');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.authCard}>
      <div className={styles.authHeader}>
        <h1 className={styles.authTitle}>Forgot Password?</h1>
        <p className={styles.authSubtitle}>
          Enter your email to receive a password reset link
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.authForm}>
        {error && (
          <div className={styles.errorMessage} role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className={styles.successMessage} role="status">
            Password reset link sent! Check your email. Redirecting to login...
          </div>
        )}

        <div className={styles.formGroup}>
          <label htmlFor="email" className={styles.label}>
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isLoading || success}
            required
            className={styles.input}
            autoComplete="email"
          />
        </div>

        <div className={styles.formActions}>
          <button
            type="submit"
            disabled={isLoading || !email || success}
            className={styles.submitButton}
          >
            {isLoading ? 'Sending...' : success ? 'Email Sent!' : 'Send Reset Link'}
          </button>
        </div>
      </form>

      <div className={styles.authFooter}>
        <p>
          Remember your password?{' '}
          <a href="/en/auth/login" className={styles.link}>
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
