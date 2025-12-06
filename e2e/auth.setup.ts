import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

/**
 * This setup test authenticates a user and saves the session state.
 * Other tests will reuse this authenticated state.
 */
setup('authenticate', async ({ page }) => {
	const email = process.env.TEST_USER_EMAIL;
	const password = process.env.TEST_USER_PASSWORD;

	if (!email || !password) {
		throw new Error(
			'TEST_USER_EMAIL and TEST_USER_PASSWORD must be set. ' +
				'Copy .env.test.example to .env.test and update values, ' +
				'then run: pnpm run setup:test-user'
		);
	}

	// Use the client-only test page for authentication
	// This ensures we start fresh without SSR state
	await page.goto('/test/client-only');

	// Wait for the page to load
	await page.waitForLoadState('networkidle');

	// Check if sign-in form is visible (not authenticated)
	const signInForm = page.locator('[data-testid="sign-in-form"]');
	const isSignInVisible = await signInForm.isVisible().catch(() => false);

	if (isSignInVisible) {
		// Fill in sign-in form
		await page.fill('[data-testid="email-input"]', email);
		await page.fill('[data-testid="password-input"]', password);

		// Click sign in button
		await page.click('[data-testid="sign-in-button"]');

		// Wait for authentication to complete
		await expect(page.locator('[data-testid="authenticated-state"]')).toBeVisible({
			timeout: 15000
		});
	}

	// Save authenticated state (cookies)
	await page.context().storageState({ path: authFile });
});
