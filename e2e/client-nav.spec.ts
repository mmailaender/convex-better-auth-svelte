import { test, expect } from '@playwright/test';

interface AuthStateEntry {
	timestamp: number;
	isLoading: boolean;
	isAuthenticated: boolean;
	unauthenticatedVisible?: boolean;
	authenticatedVisible?: boolean;
	loadingVisible?: boolean;
	url?: string;
}

declare global {
	interface Window {
		__authStateLog: AuthStateEntry[];
		__authObserver: MutationObserver;
		__observerActive: boolean;
	}
}

/**
 * Issue #21 Reproduction: Flash of unauthenticated state after client-side navigation
 *
 * Scenario:
 * 1. User starts unauthenticated on /test/client-nav/login (client-only, no SSR state)
 * 2. Signs in via authClient.signIn.email()
 * 3. Client-side navigates to /test/client-nav/dashboard via goto()
 * 4. BUG: Dashboard briefly shows isAuthenticated=false, isLoading=false
 *    (the "flash of unauthenticated state") before auth settles
 *
 * Root cause: After sign-in, the session subscription goes pending during navigation.
 * clientHasTakenOver flips back to false (sessionPending=true), falling back to
 * stale hasServerAuth (which is false since there's no SSR state).
 * This produces isAuthenticated=false, isLoading=false — the unauthenticated flash.
 */

test.describe('Client Navigation After Sign-In (Issue #21)', () => {
	// Start with clean state — no cookies
	test.use({ storageState: { cookies: [], origins: [] } });

	test('no flash of unauthenticated state after sign-in + client-side navigation', async ({
		page
	}) => {
		const email = process.env.TEST_USER_EMAIL;
		const password = process.env.TEST_USER_PASSWORD;

		if (!email || !password) {
			test.skip();
			return;
		}

		// Navigate to the login page
		await page.goto('/test/client-nav/login');

		// Wait for the sign-in form to be visible (auth has resolved as unauthenticated)
		await expect(page.locator('[data-testid="sign-in-form"]')).toBeVisible({ timeout: 10000 });

		// Wait for hydration to complete so event handlers are attached
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(500);

		// Install a MutationObserver on the page BEFORE signing in.
		// This will record every auth state transition that happens on the dashboard
		// after navigation, catching any brief flash of wrong state.
		await page.evaluate(() => {
			window.__authStateLog = [];
			window.__observerActive = false;
		});

		// Fill in credentials
		await page.fill('[data-testid="email-input"]', email);
		await page.fill('[data-testid="password-input"]', password);

		// Before clicking sign-in, set up the observer that will persist across
		// client-side navigation (SPA navigation keeps the same JS context)
		await page.evaluate(() => {
			const log = window.__authStateLog;

			// Use a MutationObserver to capture ALL state changes in the DOM
			const observer = new MutationObserver(() => {
				const isLoadingEl = document.querySelector('[data-testid="is-loading"]');
				const isAuthEl = document.querySelector('[data-testid="is-authenticated"]');
				const unauthEl = document.querySelector('[data-testid="unauthenticated-state"]');
				const authEl = document.querySelector('[data-testid="authenticated-state"]');
				const loadingEl = document.querySelector('[data-testid="loading-state"]');

				if (!isLoadingEl || !isAuthEl) return;

				const state: AuthStateEntry = {
					timestamp: Date.now(),
					isLoading: isLoadingEl.textContent?.includes('true') ?? false,
					isAuthenticated: isAuthEl.textContent?.includes('true') ?? false,
					unauthenticatedVisible: unauthEl !== null,
					authenticatedVisible: authEl !== null,
					loadingVisible: loadingEl !== null,
					url: window.location.pathname
				};

				// Only log if state actually changed from the last entry
				const last = log[log.length - 1];
				if (
					!last ||
					last.isLoading !== state.isLoading ||
					last.isAuthenticated !== state.isAuthenticated ||
					last.url !== state.url
				) {
					log.push(state);
				}
			});

			observer.observe(document.body, {
				childList: true,
				subtree: true,
				characterData: true,
				attributes: true
			});
			window.__authObserver = observer;
			window.__observerActive = true;
		});

		// Click sign in — this triggers signIn.email() then goto('/test/client-nav/dashboard')
		await page.click('[data-testid="sign-in-button"]');

		// Wait for navigation to dashboard (client-side nav)
		await page.waitForURL('**/test/client-nav/dashboard', { timeout: 15000 });

		// Wait for auth to fully settle on the dashboard
		await expect(page.locator('[data-testid="authenticated-state"]')).toBeVisible({
			timeout: 15000
		});
		await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('true');

		// Give a moment for any final state transitions to be captured
		await page.waitForTimeout(500);

		// Get the recorded auth state transitions
		const authStateLog: AuthStateEntry[] = await page.evaluate(() => window.__authStateLog);

		console.log('Auth state transitions recorded:', JSON.stringify(authStateLog, null, 2));

		// Filter to only states observed on the dashboard page
		const dashboardStates = authStateLog.filter((s) => s.url === '/test/client-nav/dashboard');

		console.log('Dashboard states:', JSON.stringify(dashboardStates, null, 2));

		// THE BUG: After arriving on the dashboard, there should NEVER be a state where
		// isAuthenticated=false AND isLoading=false. That's the "flash of unauthenticated state"
		// where the user sees the login form / unauthenticated UI before auth catches up.
		const flashStates = dashboardStates.filter(
			(s) => s.isAuthenticated === false && s.isLoading === false
		);

		expect(
			flashStates,
			'Found flash of unauthenticated state (isAuthenticated=false, isLoading=false) on dashboard after sign-in + client navigation. ' +
				'States: ' +
				JSON.stringify(flashStates, null, 2)
		).toHaveLength(0);

		// Also verify: the "unauthenticated-state" div should never have been rendered on the dashboard
		const unauthFlash = dashboardStates.filter((s) => s.unauthenticatedVisible === true);

		expect(
			unauthFlash,
			'The unauthenticated UI was briefly visible on the dashboard after sign-in. ' +
				'States: ' +
				JSON.stringify(unauthFlash, null, 2)
		).toHaveLength(0);
	});

	test('isLoading should not get stuck as true after sign-in + client-side navigation', async ({
		page
	}) => {
		const email = process.env.TEST_USER_EMAIL;
		const password = process.env.TEST_USER_PASSWORD;

		if (!email || !password) {
			test.skip();
			return;
		}

		await page.goto('/test/client-nav/login');
		await expect(page.locator('[data-testid="sign-in-form"]')).toBeVisible({ timeout: 10000 });

		// Wait for hydration
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(500);

		await page.fill('[data-testid="email-input"]', email);
		await page.fill('[data-testid="password-input"]', password);
		await page.click('[data-testid="sign-in-button"]');

		// Wait for client-side navigation to dashboard
		await page.waitForURL('**/test/client-nav/dashboard', { timeout: 15000 });

		// After sign-in + navigation, auth should eventually resolve.
		// The bug: isLoading stays true permanently when no callbackURL is defined.
		// We give it a generous timeout but it should NOT stay loading forever.
		await expect(page.locator('[data-testid="is-loading"]')).toContainText('false', {
			timeout: 15000
		});
		await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('true', {
			timeout: 15000
		});

		// Verify user data actually loads
		await expect(page.locator('[data-testid="user-email"]')).toBeVisible({ timeout: 10000 });
	});

	test('sign-in on same page without navigation shows no unauthenticated flash', async ({
		page
	}) => {
		const email = process.env.TEST_USER_EMAIL;
		const password = process.env.TEST_USER_PASSWORD;

		if (!email || !password) {
			test.skip();
			return;
		}

		// This is the "control" test — sign in on the client-only page WITHOUT navigation.
		// This should work correctly (no flash) since the layout context persists.
		await page.goto('/test/client-only');
		await expect(page.locator('[data-testid="sign-in-form"]')).toBeVisible({ timeout: 10000 });

		// Set up observer
		await page.evaluate(() => {
			window.__authStateLog = [];
			const log = window.__authStateLog;

			const observer = new MutationObserver(() => {
				const isLoadingEl = document.querySelector('[data-testid="is-loading"]');
				const isAuthEl = document.querySelector('[data-testid="is-authenticated"]');

				if (!isLoadingEl || !isAuthEl) return;

				const state: AuthStateEntry = {
					timestamp: Date.now(),
					isLoading: isLoadingEl.textContent?.includes('true') ?? false,
					isAuthenticated: isAuthEl.textContent?.includes('true') ?? false
				};

				const last = log[log.length - 1];
				if (
					!last ||
					last.isLoading !== state.isLoading ||
					last.isAuthenticated !== state.isAuthenticated
				) {
					log.push(state);
				}
			});

			observer.observe(document.body, {
				childList: true,
				subtree: true,
				characterData: true,
				attributes: true
			});
		});

		await page.fill('[data-testid="email-input"]', email);
		await page.fill('[data-testid="password-input"]', password);
		await page.click('[data-testid="sign-in-button"]');

		await expect(page.locator('[data-testid="authenticated-state"]')).toBeVisible({
			timeout: 15000
		});

		await page.waitForTimeout(500);

		const authStateLog: AuthStateEntry[] = await page.evaluate(() => window.__authStateLog);
		console.log('Same-page sign-in state transitions:', JSON.stringify(authStateLog, null, 2));

		// After the initial unauthenticated state (which is expected before sign-in),
		// once isAuthenticated becomes true, it should never go back to
		// isAuthenticated=false + isLoading=false
		let sawAuthenticated = false;
		const badTransitions = authStateLog.filter((s) => {
			if (s.isAuthenticated) sawAuthenticated = true;
			// After being authenticated, going to isAuthenticated=false + isLoading=false is bad
			return sawAuthenticated && !s.isAuthenticated && !s.isLoading;
		});

		expect(
			badTransitions,
			'After becoming authenticated, state reverted to unauthenticated+not-loading'
		).toHaveLength(0);
	});
});

/**
 * SSR variant of Issue #21: This is the actual bug scenario.
 *
 * When the layout provides getServerState (SSR), and the page was loaded
 * while unauthenticated, the server captures:
 *   hasServerState=true, hasServerAuth=false
 *
 * After sign-in + goto(), the session goes pending:
 *   clientHasTakenOver = hasReceivedClientData && !sessionPending → false
 *   isAuthenticated = hasServerAuth → false (stale!)
 *   isLoading = !hasServerState → false
 *
 * Result: isAuthenticated=false, isLoading=false — the unauthenticated flash.
 * The user sees the unauthenticated UI for a split second before auth settles.
 */
test.describe('Client Navigation After Sign-In with SSR (Issue #21)', () => {
	// Start with clean state — no cookies (unauthenticated SSR)
	test.use({ storageState: { cookies: [], origins: [] } });

	test('no flash of unauthenticated state after sign-in + client-side navigation (SSR layout)', async ({
		page
	}) => {
		const email = process.env.TEST_USER_EMAIL;
		const password = process.env.TEST_USER_PASSWORD;

		if (!email || !password) {
			test.skip();
			return;
		}

		// Navigate to the SSR login page (server state: hasServerAuth=false, hasServerState=true)
		await page.goto('/test/client-nav-ssr/login');

		// Wait for the sign-in form to be visible
		await expect(page.locator('[data-testid="sign-in-form"]')).toBeVisible({ timeout: 10000 });

		// Verify SSR provided state: isAuthenticated=false, isLoading=false
		await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('false');
		await expect(page.locator('[data-testid="is-loading"]')).toContainText('false');

		// Wait for hydration to complete so event handlers are attached
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(500);

		// Install MutationObserver to record all auth state transitions
		await page.evaluate(() => {
			window.__authStateLog = [];
			const log = window.__authStateLog;

			const observer = new MutationObserver(() => {
				const isLoadingEl = document.querySelector('[data-testid="is-loading"]');
				const isAuthEl = document.querySelector('[data-testid="is-authenticated"]');
				const unauthEl = document.querySelector('[data-testid="unauthenticated-state"]');
				const authEl = document.querySelector('[data-testid="authenticated-state"]');
				const loadingEl = document.querySelector('[data-testid="loading-state"]');

				if (!isLoadingEl || !isAuthEl) return;

				const state: AuthStateEntry = {
					timestamp: Date.now(),
					isLoading: isLoadingEl.textContent?.includes('true') ?? false,
					isAuthenticated: isAuthEl.textContent?.includes('true') ?? false,
					unauthenticatedVisible: unauthEl !== null,
					authenticatedVisible: authEl !== null,
					loadingVisible: loadingEl !== null,
					url: window.location.pathname
				};

				const last = log[log.length - 1];
				if (
					!last ||
					last.isLoading !== state.isLoading ||
					last.isAuthenticated !== state.isAuthenticated ||
					last.url !== state.url
				) {
					log.push(state);
				}
			});

			observer.observe(document.body, {
				childList: true,
				subtree: true,
				characterData: true,
				attributes: true
			});
		});

		// Fill in credentials and sign in
		await page.fill('[data-testid="email-input"]', email);
		await page.fill('[data-testid="password-input"]', password);
		await page.click('[data-testid="sign-in-button"]');

		// Wait for navigation to SSR dashboard (client-side nav)
		await page.waitForURL('**/test/client-nav-ssr/dashboard', { timeout: 15000 });

		// Wait for auth to fully settle
		await expect(page.locator('[data-testid="authenticated-state"]')).toBeVisible({
			timeout: 15000
		});
		await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('true');

		await page.waitForTimeout(500);

		// Get recorded state transitions
		const authStateLog: AuthStateEntry[] = await page.evaluate(() => window.__authStateLog);

		console.log('SSR Auth state transitions recorded:', JSON.stringify(authStateLog, null, 2));

		// Filter to dashboard states only
		const dashboardStates = authStateLog.filter((s) => s.url === '/test/client-nav-ssr/dashboard');

		console.log('SSR Dashboard states:', JSON.stringify(dashboardStates, null, 2));

		// THE BUG: After arriving on the dashboard, there should NEVER be a state where
		// isAuthenticated=false AND isLoading=false. With SSR, stale hasServerAuth=false
		// causes exactly this flash.
		const flashStates = dashboardStates.filter(
			(s) => s.isAuthenticated === false && s.isLoading === false
		);

		expect(
			flashStates,
			'BUG REPRODUCED: Flash of unauthenticated state (isAuthenticated=false, isLoading=false) ' +
				'on SSR dashboard after sign-in + client navigation. ' +
				'This is caused by stale hasServerAuth=false being used as fallback during session pending. ' +
				'States: ' +
				JSON.stringify(flashStates, null, 2)
		).toHaveLength(0);

		// Also verify: the "unauthenticated-state" div should never have been rendered
		const unauthFlash = dashboardStates.filter((s) => s.unauthenticatedVisible === true);

		expect(
			unauthFlash,
			'BUG REPRODUCED: The unauthenticated UI was briefly visible on the SSR dashboard. ' +
				'States: ' +
				JSON.stringify(unauthFlash, null, 2)
		).toHaveLength(0);
	});

	test('isLoading should not get stuck as true after sign-in + client-side navigation (SSR layout)', async ({
		page
	}) => {
		const email = process.env.TEST_USER_EMAIL;
		const password = process.env.TEST_USER_PASSWORD;

		if (!email || !password) {
			test.skip();
			return;
		}

		await page.goto('/test/client-nav-ssr/login');
		await expect(page.locator('[data-testid="sign-in-form"]')).toBeVisible({ timeout: 10000 });

		// Wait for hydration
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(500);

		await page.fill('[data-testid="email-input"]', email);
		await page.fill('[data-testid="password-input"]', password);
		await page.click('[data-testid="sign-in-button"]');

		// Wait for client-side navigation to dashboard
		await page.waitForURL('**/test/client-nav-ssr/dashboard', { timeout: 15000 });

		// Auth should eventually resolve — not stay stuck in loading
		await expect(page.locator('[data-testid="is-loading"]')).toContainText('false', {
			timeout: 15000
		});
		await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('true', {
			timeout: 15000
		});

		// Verify user data actually loads
		await expect(page.locator('[data-testid="user-email"]')).toBeVisible({ timeout: 10000 });
	});
});
