import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Forgot Password Page
 *
 * Tests the password reset request flow
 */

test.describe('Forgot Password Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/auth/forgot-password');
  });

  test('should display forgot password form', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();

    // Check subtitle/description
    await expect(page.getByText(/enter your email/i)).toBeVisible();

    // Check form elements
    await expect(page.getByLabelText(/email address/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();

    // Check login link
    await expect(page.getByText(/remember your password/i)).toBeVisible();
  });

  test('should disable submit button when email is empty', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /send reset link/i });
    await expect(submitButton).toBeDisabled();
  });

  test('should enable submit button when email is filled', async ({ page }) => {
    const emailInput = page.getByLabelText(/email address/i);
    const submitButton = page.getByRole('button', { name: /send reset link/i });

    // Initially disabled
    await expect(submitButton).toBeDisabled();

    // Fill email
    await emailInput.fill('user@example.com');

    // Now enabled
    await expect(submitButton).toBeEnabled();
  });

  test('should show validation error for invalid email', async ({ page }) => {
    const emailInput = page.getByLabelText(/email address/i);
    const submitButton = page.getByRole('button', { name: /send reset link/i });

    // Fill with invalid email
    await emailInput.fill('not-an-email');
    await submitButton.click();

    // Check for error
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('should show loading state during submission', async ({ page }) => {
    const emailInput = page.getByLabelText(/email address/i);
    const submitButton = page.getByRole('button', { name: /send reset link/i });

    // Fill form
    await emailInput.fill('user@example.com');
    await submitButton.click();

    // Check for loading state
    await expect(page.getByRole('button', { name: /sending/i })).toBeVisible();
  });

  test('should show success message after submission', async ({ page }) => {
    const emailInput = page.getByLabelText(/email address/i);
    const submitButton = page.getByRole('button', { name: /send reset link/i });

    // Fill and submit
    await emailInput.fill('user@example.com');
    await submitButton.click();

    // Wait for success message
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByRole('status')).toContainText(/reset link sent/i);
  });

  test('should disable form after successful submission', async ({ page }) => {
    const emailInput = page.getByLabelText(/email address/i);
    const submitButton = page.getByRole('button', { name: /send reset link/i });

    // Fill and submit
    await emailInput.fill('user@example.com');
    await submitButton.click();

    // Wait for success
    await expect(page.getByRole('status')).toBeVisible();

    // Form should be disabled
    await expect(emailInput).toBeDisabled();
    await expect(submitButton).toBeDisabled();
  });

  test('should redirect to login after success', async ({ page }) => {
    const emailInput = page.getByLabelText(/email address/i);
    const submitButton = page.getByRole('button', { name: /send reset link/i });

    // Fill and submit
    await emailInput.fill('user@example.com');
    await submitButton.click();

    // Should redirect to login after timeout
    await page.waitForURL(/\/login/, { timeout: 5000 });
  });

  test('should navigate to login via link', async ({ page }) => {
    const loginLink = page.getByRole('link', { name: /sign in/i });
    await loginLink.click();

    // Should navigate to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should have accessible form elements', async ({ page }) => {
    const emailInput = page.getByLabelText(/email address/i);

    // Check input type
    await expect(emailInput).toHaveAttribute('type', 'email');

    // Check autocomplete
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');

    // Check required
    await expect(emailInput).toHaveAttribute('required');
  });
});
