import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Dashboard Page
 *
 * Tests the protected dashboard page and authentication checks
 */

test.describe('Dashboard Page', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/en/dashboard');

    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test.describe('When authenticated', () => {
    test.beforeEach(async ({ page }) => {
      // Simulate authentication by setting session storage
      await page.goto('/en/auth/login');

      // Login first
      const emailInput = page.getByLabel(/email address/i);
      const passwordInput = page.getByLabel(/password/i);
      const submitButton = page.getByRole('button', { name: /next/i });

      await emailInput.fill('user@example.com');
      await passwordInput.fill('password123');
      await submitButton.click();

      // Wait for dashboard redirect
      await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    });

    test('should display dashboard content', async ({ page }) => {
      // Check dashboard title
      await expect(page.getByRole('heading', { name: /^dashboard$/i })).toBeVisible();

      // Check welcome message
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

      // Check user info card
      await expect(page.getByRole('heading', { name: /your profile/i })).toBeVisible();

      // Check navigation card
      await expect(page.getByRole('heading', { name: /quick links/i })).toBeVisible();
    });

    test('should display user information', async ({ page }) => {
      // Check for user info fields
      await expect(page.getByText(/email:/i)).toBeVisible();
      await expect(page.getByText(/user id:/i)).toBeVisible();
      await expect(page.getByText(/account type:/i)).toBeVisible();
      await expect(page.getByText(/email verified:/i)).toBeVisible();
    });

    test('should display quick links navigation', async ({ page }) => {
      // Check navigation links
      await expect(page.getByRole('link', { name: /users/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /urls/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /about/i })).toBeVisible();
    });

    test('should navigate to users page', async ({ page }) => {
      const usersLink = page.getByRole('link', { name: /users/i });
      await usersLink.click();

      // Should navigate to users page
      await expect(page).toHaveURL(/\/users/);
    });

    test('should navigate to urls page', async ({ page }) => {
      const urlsLink = page.getByRole('link', { name: /urls/i });
      await urlsLink.click();

      // Should navigate to urls page
      await expect(page).toHaveURL(/\/urls/);
    });

    test('should have logout button', async ({ page }) => {
      const logoutButton = page.getByRole('button', { name: /sign out/i });
      await expect(logoutButton).toBeVisible();
    });

    test('should logout and redirect to login', async ({ page }) => {
      const logoutButton = page.getByRole('button', { name: /sign out/i });
      await logoutButton.click();

      // Should redirect to login
      await page.waitForURL(/\/login/, { timeout: 5000 });
      await expect(page).toHaveURL(/\/login/);

      // Try to access dashboard again (should redirect to login)
      await page.goto('/en/dashboard');
      await page.waitForURL(/\/login/, { timeout: 5000 });
    });
  });
});

/**
 * E2E Tests for Dashboard Authentication Flow
 */
test.describe('Dashboard Authentication', () => {
  test('should show loading state while checking authentication', async ({ page }) => {
    // Mock slow authentication check
    await page.goto('/en/dashboard');

    // Should show loading or redirect immediately
    const loading = page.getByText(/loading/i);
    const isVisible = await loading.isVisible().catch(() => false);

    // Either loading is visible or we're redirected to login
    expect(isVisible || (await page.url().includes('/login'))).toBeTruthy();
  });
});
