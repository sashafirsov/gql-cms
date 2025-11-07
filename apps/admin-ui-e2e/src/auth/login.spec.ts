import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Login Page
 *
 * Tests the complete login flow including:
 * - Page rendering
 * - Form validation
 * - Successful login
 * - Error handling
 */

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page before each test
    await page.goto('/en/auth/login');
  });

  test('should display login form', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

    // Check form elements
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible();

    // Check forgot password link
    await expect(page.getByText(/forgot your password/i)).toBeVisible();
  });

  test('should disable submit button when form is empty', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /next/i });
    await expect(submitButton).toBeDisabled();
  });

  test('should enable submit button when form is filled', async ({ page }) => {
    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/password/i);
    const submitButton = page.getByRole('button', { name: /next/i });

    // Initially disabled
    await expect(submitButton).toBeDisabled();

    // Fill form
    await emailInput.fill('user@example.com');
    await passwordInput.fill('password123');

    // Now enabled
    await expect(submitButton).toBeEnabled();
  });

  test('should show validation error for invalid email', async ({ page }) => {
    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/password/i);
    const submitButton = page.getByRole('button', { name: /next/i });

    // Fill with invalid email
    await emailInput.fill('not-an-email');
    await passwordInput.fill('password123');
    await submitButton.click();

    // Check for error message
    await expect(page.getByRole('alert')).toContainText(/valid email/i);
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.getByLabel(/password/i);
    const toggleButton = page.getByRole('button', { name: /show password/i });

    // Initially hidden (type="password")
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Type password
    await passwordInput.fill('secret123');

    // Click toggle
    await toggleButton.click();

    // Now visible (type="text")
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Toggle back
    const hideButton = page.getByRole('button', { name: /hide password/i });
    await hideButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should show loading state during submission', async ({ page }) => {
    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/password/i);
    const submitButton = page.getByRole('button', { name: /next/i });

    // Fill form
    await emailInput.fill('user@example.com');
    await passwordInput.fill('password123');

    // Submit
    await submitButton.click();

    // Check for loading state
    await expect(page.getByRole('button', { name: /signing in/i })).toBeVisible();
  });

  test('should clear error when user types', async ({ page }) => {
    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/password/i);
    const submitButton = page.getByRole('button', { name: /next/i });

    // Trigger an error (invalid email)
    await emailInput.fill('invalid');
    await passwordInput.fill('password123');
    await submitButton.click();

    // Error should be visible
    await expect(page.getByRole('alert')).toBeVisible();

    // Type in email field
    await emailInput.fill('user@example.com');

    // Error should be cleared
    await expect(page.getByRole('alert')).not.toBeVisible();
  });

  test('should navigate to forgot password page', async ({ page }) => {
    const forgotPasswordLink = page.getByText(/forgot your password/i);
    await forgotPasswordLink.click();

    // Should navigate to forgot password page
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('should have accessible form elements', async ({ page }) => {
    // Check for proper labels
    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/password/i);

    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');

    // Check required attributes
    await expect(emailInput).toHaveAttribute('required');
    await expect(passwordInput).toHaveAttribute('required');
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Tab to email field
    await page.keyboard.press('Tab');
    const emailInput = page.getByLabel(/email address/i);
    await expect(emailInput).toBeFocused();

    // Type email
    await page.keyboard.type('user@example.com');

    // Tab to password field
    await page.keyboard.press('Tab');
    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toBeFocused();

    // Type password
    await page.keyboard.type('password123');

    // Tab to password toggle
    await page.keyboard.press('Tab');

    // Tab to submit button
    await page.keyboard.press('Tab');
    const submitButton = page.getByRole('button', { name: /next/i });
    await expect(submitButton).toBeFocused();
  });
});

/**
 * E2E Tests for Login Flow Integration
 * Tests with mock backend responses
 */
test.describe('Login Flow Integration', () => {
  test('should redirect to dashboard on successful login', async ({ page }) => {
    await page.goto('/en/auth/login');

    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/password/i);
    const submitButton = page.getByRole('button', { name: /next/i });

    // Fill and submit
    await emailInput.fill('user@example.com');
    await passwordInput.fill('password123');
    await submitButton.click();

    // Wait for redirect (with timeout for API call)
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Verify dashboard page loaded
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('should show error message for invalid credentials', async ({ page }) => {
    await page.goto('/en/auth/login');

    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/password/i);
    const submitButton = page.getByRole('button', { name: /next/i });

    // Use credentials that trigger error
    await emailInput.fill('error@example.com');
    await passwordInput.fill('wrongpassword');
    await submitButton.click();

    // Wait for error message
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/invalid/i);
  });
});
