import { test, expect } from '@playwright/test';

/**
 * Test Scenarios:
 * 1. SSR Authenticated - Server provides auth state, client hydrates
 * 2. SSR Not Authenticated - Server says no auth, client shows login
 * 3. SSR → Sign Out - Start authenticated, sign out
 * 4. Client-only Auth - No SSR state, client handles everything
 * 5. Client-only → Sign In - Start unauthenticated, sign in
 * 6. Public Queries - Work regardless of auth state
 * 7. Protected Queries - Skip when unauthenticated, run when authenticated
 */

test.describe('SSR Authentication', () => {
	test('authenticated user sees content immediately without loading flash', async ({ page }) => {
		await page.goto('/test/ssr');

		// SSR should provide auth state immediately
		const authState = page.locator('[data-testid="auth-state"]');
		await expect(authState).toBeVisible();

		// isLoading should be false immediately (no loading flash)
		await expect(page.locator('[data-testid="is-loading"]')).toContainText('false');

		// isAuthenticated should be true immediately
		await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('true');

		// SSR data should show authenticated state
		await expect(page.locator('[data-testid="ssr-auth-state"]')).toContainText('true');

		// User email should be visible (from SSR initialData)
		await expect(page.locator('[data-testid="user-email"]')).toBeVisible({ timeout: 5000 });
	});

	test('SSR provides initial data that persists after hydration', async ({ page }) => {
		await page.goto('/test/ssr');

		// SSR current user should be populated
		await expect(page.locator('[data-testid="ssr-current-user"]')).not.toContainText('null');

		// Wait for hydration
		await page.waitForLoadState('networkidle');

		// User data should still be visible (no flash to undefined)
		await expect(page.locator('[data-testid="user-email"]')).toBeVisible();
		await expect(page.locator('[data-testid="user-none"]')).not.toBeVisible();
	});
});

test.describe('SSR Not Authenticated', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('unauthenticated user sees correct state from SSR', async ({ page }) => {
		await page.goto('/test/ssr');

		// isLoading should be false (SSR provides definitive state)
		await expect(page.locator('[data-testid="is-loading"]')).toContainText('false');

		// isAuthenticated should be false
		await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('false');

		// SSR auth state should show not authenticated
		await expect(page.locator('[data-testid="ssr-auth-state"]')).toContainText('false');
	});
});

test.describe('SSR Sign Out Flow', () => {
	test('authenticated user can sign out', async ({ page }) => {
		await page.goto('/test/ssr');

		// Wait for hydration to complete
		await page.waitForLoadState('networkidle');

		// Should be authenticated initially
		await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('true');
		await expect(page.locator('[data-testid="sign-out-button"]')).toBeVisible();

		// Wait for event handlers to be attached after hydration
		await page.waitForTimeout(500);

		// Click sign out
		await page.locator('[data-testid="sign-out-button"]').click();

		// Should show unauthenticated state
		await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('false', {
			timeout: 10000
		});

		// Sign out button should be hidden
		await expect(page.locator('[data-testid="sign-out-button"]')).not.toBeVisible();
	});
});

test.describe('Client-only Authentication', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('shows loading state initially then resolves', async ({ page }) => {
		await page.goto('/test/client-only');

		// Should show loading state initially (no SSR auth)
		// Note: This might be very fast, so we check the form appears
		await expect(page.locator('[data-testid="sign-in-form"]')).toBeVisible({ timeout: 10000 });

		// isAuthenticated should be false
		await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('false');
	});

	test('can sign in from unauthenticated state', async ({ page }) => {
		const email = process.env.TEST_USER_EMAIL;
		const password = process.env.TEST_USER_PASSWORD;

		if (!email || !password) {
			test.skip();
			return;
		}

		await page.goto('/test/client-only');

		// Wait for sign in form
		await expect(page.locator('[data-testid="sign-in-form"]')).toBeVisible({ timeout: 10000 });

		// Fill credentials
		await page.fill('[data-testid="email-input"]', email);
		await page.fill('[data-testid="password-input"]', password);

		// Submit
		await page.click('[data-testid="sign-in-button"]');

		// Should show authenticated state
		await expect(page.locator('[data-testid="authenticated-state"]')).toBeVisible({
			timeout: 10000
		});
		await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('true');

		// User email should appear
		await expect(page.locator('[data-testid="user-email"]')).toBeVisible({ timeout: 5000 });
	});
});

test.describe('Query Behavior - Authenticated', () => {
	test('public query runs and shows data', async ({ page }) => {
		await page.goto('/test/queries');

		// Public query should show data
		await expect(page.locator('[data-testid="public-message"]')).toContainText(
			'This is public data'
		);
	});

	test('protected query runs when authenticated', async ({ page }) => {
		await page.goto('/test/queries');

		// Should be authenticated
		await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('true');

		// Protected query should show user email
		await expect(page.locator('[data-testid="protected-email"]')).toBeVisible({ timeout: 5000 });
	});

	test('SSR provides initial data for both queries', async ({ page }) => {
		await page.goto('/test/queries');

		// SSR public data should be present
		await expect(page.locator('[data-testid="ssr-public"]')).toContainText('This is public data');

		// SSR protected data should be present (authenticated user)
		await expect(page.locator('[data-testid="ssr-protected"]')).not.toContainText('null');
	});
});

test.describe('Query Behavior - Unauthenticated', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('public query runs without auth', async ({ page }) => {
		await page.goto('/test/queries');

		// Public query should still work
		await expect(page.locator('[data-testid="public-message"]')).toContainText(
			'This is public data'
		);
	});

	test('protected query is skipped when unauthenticated', async ({ page }) => {
		await page.goto('/test/queries');

		// Should not be authenticated
		await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('false');

		// Protected query should be skipped
		await expect(page.locator('[data-testid="protected-skipped"]')).toBeVisible();
	});
});
