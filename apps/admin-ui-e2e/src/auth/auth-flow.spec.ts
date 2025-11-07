import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Complete Authentication Flow
 *
 * Tests the entire user journey through authentication
 */

test.describe('Complete Authentication Flow', () => {
  test('should complete full registration and login flow', async ({ page }) => {
    // Step 1: Navigate to register page
    await page.goto('/en/auth/register');
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();

    // Step 2: Fill registration form
    const displayName = page.getByLabel(/display name/i);
    const email = page.getByLabel(/email address/i);
    const password = page.getByLabel(/^password$/i);
    const confirmPassword = page.getByLabel(/confirm password/i);
    const submitButton = page.getByRole('button', { name: /sign up/i });

    await displayName.fill('Test User');
    await email.fill('testuser@example.com');
    await password.fill('Password123!');
    await confirmPassword.fill('Password123!');
    await submitButton.click();

    // Step 3: Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 10000 });

    // Step 4: Login with new credentials
    const loginEmail = page.getByLabel(/email address/i);
    const loginPassword = page.getByLabel(/password/i);
    const loginButton = page.getByRole('button', { name: /next/i });

    await loginEmail.fill('testuser@example.com');
    await loginPassword.fill('Password123!');
    await loginButton.click();

    // Step 5: Should redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('should handle login -> dashboard -> logout flow', async ({ page }) => {
    // Step 1: Login
    await page.goto('/en/auth/login');

    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/password/i);
    const submitButton = page.getByRole('button', { name: /next/i });

    await emailInput.fill('user@example.com');
    await passwordInput.fill('password123');
    await submitButton.click();

    // Step 2: Verify dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    // Step 3: Logout
    const logoutButton = page.getByRole('button', { name: /sign out/i });
    await logoutButton.click();

    // Step 4: Verify redirected to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('should handle forgot password -> login flow', async ({ page }) => {
    // Step 1: Navigate to login
    await page.goto('/en/auth/login');

    // Step 2: Click forgot password
    const forgotLink = page.getByText(/forgot your password/i);
    await forgotLink.click();

    // Step 3: Verify forgot password page
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();

    // Step 4: Submit email
    const emailInput = page.getByLabel(/email address/i);
    const submitButton = page.getByRole('button', { name: /send reset link/i });

    await emailInput.fill('user@example.com');
    await submitButton.click();

    // Step 5: Wait for success and redirect
    await expect(page.getByRole('status')).toBeVisible();
    await page.waitForURL(/\/login/, { timeout: 5000 });

    // Step 6: Verify back at login
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('should navigate between auth pages', async ({ page }) => {
    // Start at login
    await page.goto('/en/auth/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

    // Navigate to register from login
    // Note: Would need a register link on login page for this test
    await page.goto('/en/auth/register');
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();

    // Navigate back to login
    const loginLink = page.getByRole('link', { name: /sign in/i });
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);

    // Navigate to forgot password
    const forgotLink = page.getByText(/forgot your password/i);
    await forgotLink.click();
    await expect(page).toHaveURL(/\/forgot-password/);

    // Navigate back to login
    const backToLogin = page.getByRole('link', { name: /sign in/i });
    await backToLogin.click();
    await expect(page).toHaveURL(/\/login/);
  });
});

/**
 * E2E Tests for Authentication Edge Cases
 */
test.describe('Authentication Edge Cases', () => {
  test('should prevent access to dashboard without authentication', async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();

    // Try direct navigation to dashboard
    await page.goto('/en/dashboard');

    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('should persist authentication across page navigation', async ({ page }) => {
    // Login
    await page.goto('/en/auth/login');

    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/password/i);
    const submitButton = page.getByRole('button', { name: /next/i });

    await emailInput.fill('user@example.com');
    await passwordInput.fill('password123');
    await submitButton.click();

    // Wait for dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Navigate away
    await page.goto('/en/about');

    // Navigate back to dashboard
    await page.goto('/en/dashboard');

    // Should still be authenticated
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('should handle multiple failed login attempts', async ({ page }) => {
    await page.goto('/en/auth/login');

    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/password/i);
    const submitButton = page.getByRole('button', { name: /next/i });

    // Attempt 1
    await emailInput.fill('error@example.com');
    await passwordInput.fill('wrong1');
    await submitButton.click();
    await expect(page.getByRole('alert')).toBeVisible();

    // Attempt 2
    await emailInput.fill('error@example.com');
    await passwordInput.fill('wrong2');
    await submitButton.click();
    await expect(page.getByRole('alert')).toBeVisible();

    // Should still be able to try again
    await expect(submitButton).toBeEnabled();
  });
});
