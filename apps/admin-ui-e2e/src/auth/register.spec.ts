import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Register Page
 *
 * Tests the complete registration flow including:
 * - Page rendering
 * - Form validation
 * - Successful registration
 * - Error handling
 */

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/auth/register');
  });

  test('should display registration form', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();

    // Check form elements
    await expect(page.getByLabel( /display name/i)).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible();

    // Check login link
    await expect(page.getByText(/already have an account/i)).toBeVisible();
  });

  test('should disable submit button when required fields are empty', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /sign up/i });
    await expect(submitButton).toBeDisabled();
  });

  test('should enable submit button when all required fields are filled', async ({ page }) => {
    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/^password$/i);
    const confirmPasswordInput = page.getByLabel(/confirm password/i);
    const submitButton = page.getByRole('button', { name: /sign up/i });

    // Fill required fields
    await emailInput.fill('newuser@example.com');
    await passwordInput.fill('password123');
    await confirmPasswordInput.fill('password123');

    // Submit should be enabled
    await expect(submitButton).toBeEnabled();
  });

  test('should show error when passwords do not match', async ({ page }) => {
    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/^password$/i);
    const confirmPasswordInput = page.getByLabel(/confirm password/i);
    const submitButton = page.getByRole('button', { name: /sign up/i });

    // Fill with mismatched passwords
    await emailInput.fill('newuser@example.com');
    await passwordInput.fill('password123');
    await confirmPasswordInput.fill('different456');
    await submitButton.click();

    // Check for error
    await expect(page.getByRole('alert')).toContainText(/passwords do not match/i);
  });

  test('should show error for short password', async ({ page }) => {
    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/^password$/i);
    const confirmPasswordInput = page.getByLabel(/confirm password/i);
    const submitButton = page.getByRole('button', { name: /sign up/i });

    // Fill with short password
    await emailInput.fill('newuser@example.com');
    await passwordInput.fill('short');
    await confirmPasswordInput.fill('short');
    await submitButton.click();

    // Check for error
    await expect(page.getByRole('alert')).toContainText(/at least 8 characters/i);
  });

  test('should show loading state during submission', async ({ page }) => {
    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/^password$/i);
    const confirmPasswordInput = page.getByLabel(/confirm password/i);
    const submitButton = page.getByRole('button', { name: /sign up/i });

    // Fill form
    await emailInput.fill('newuser@example.com');
    await passwordInput.fill('password123');
    await confirmPasswordInput.fill('password123');
    await submitButton.click();

    // Check for loading state
    await expect(page.getByRole('button', { name: /creating account/i })).toBeVisible();
  });

  test('should navigate to login page via link', async ({ page }) => {
    const loginLink = page.getByRole('link', { name: /sign in/i });
    await loginLink.click();

    // Should navigate to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should have accessible form elements', async ({ page }) => {
    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/^password$/i);
    const confirmPasswordInput = page.getByLabel(/confirm password/i);

    // Check input types
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(confirmPasswordInput).toHaveAttribute('type', 'password');

    // Check autocomplete
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'new-password');
    await expect(confirmPasswordInput).toHaveAttribute('autocomplete', 'new-password');

    // Check required
    await expect(emailInput).toHaveAttribute('required');
    await expect(passwordInput).toHaveAttribute('required');
    await expect(confirmPasswordInput).toHaveAttribute('required');
  });

  test('should allow optional display name', async ({ page }) => {
    const displayNameInput = page.getByLabel(/display name/i);
    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/^password$/i);
    const confirmPasswordInput = page.getByLabel(/confirm password/i);
    const submitButton = page.getByRole('button', { name: /sign up/i });

    // Display name should not be required
    await expect(displayNameInput).not.toHaveAttribute('required');

    // Should be able to submit without display name
    await emailInput.fill('newuser@example.com');
    await passwordInput.fill('password123');
    await confirmPasswordInput.fill('password123');

    await expect(submitButton).toBeEnabled();
  });
});

/**
 * E2E Tests for Registration Flow Integration
 */
test.describe('Register Flow Integration', () => {
  test('should redirect to login on successful registration', async ({ page }) => {
    await page.goto('/en/auth/register');

    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/^password$/i);
    const confirmPasswordInput = page.getByLabel(/confirm password/i);
    const submitButton = page.getByRole('button', { name: /sign up/i });

    // Fill and submit
    await emailInput.fill('newuser@example.com');
    await passwordInput.fill('Password123!');
    await confirmPasswordInput.fill('Password123!');
    await submitButton.click();

    // Should redirect to login with query param
    await page.waitForURL(/\/login.*registered=true/, { timeout: 10000 });
  });

  test('should show error for existing email', async ({ page }) => {
    await page.goto('/en/auth/register');

    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/^password$/i);
    const confirmPasswordInput = page.getByLabel(/confirm password/i);
    const submitButton = page.getByRole('button', { name: /sign up/i });

    // Use email that triggers error
    await emailInput.fill('existing@example.com');
    await passwordInput.fill('Password123!');
    await confirmPasswordInput.fill('Password123!');
    await submitButton.click();

    // Wait for error message
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/already registered/i);
  });
});
