import { test, expect, type Page } from '@playwright/test';

/**
 * Shallow routing (SvelteKit 3)
 *
 * SvelteKit 3 also runs navigation hooks for `goto(..., { shallow: true })`.
 * createSvelteAuthClient's beforeNavigate guard sets isLoading for signed-out
 * users so a real navigation can't flash unauthenticated content. A shallow
 * navigation keeps the current page, so it must not trigger that guard.
 */

/** Record every isLoading value the page renders while `action` runs. */
async function recordIsLoading(page: Page, action: () => Promise<void>) {
	await page.evaluate(() => {
		const states: string[] = [];
		(window as unknown as { __isLoadingStates: string[] }).__isLoadingStates = states;
		const target = document.querySelector('[data-testid="is-loading"]')!;
		new MutationObserver(() => states.push(target.textContent?.trim() ?? '')).observe(target, {
			childList: true,
			characterData: true,
			subtree: true
		});
	});

	await action();
	// Outlast the guard's 50 ms timer and any trailing session update.
	await page.waitForTimeout(500);

	return page.evaluate(
		() => (window as unknown as { __isLoadingStates: string[] }).__isLoadingStates
	);
}

test.describe('Shallow routing', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test.beforeEach(async ({ page }) => {
		await page.goto('/test/shallow');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('false');
		await expect(page.locator('[data-testid="is-loading"]')).toContainText('false');
	});

	test('does not flash isLoading for a signed-out user', async ({ page }) => {
		const states = await recordIsLoading(page, async () => {
			await page.locator('[data-testid="shallow-nav"]').click();
			await expect(page.locator('[data-testid="panel"]')).toContainText('open');
		});

		expect(page.url()).toContain('panel=open');
		expect(states.filter((s) => s.includes('true'))).toEqual([]);
	});

	test('control: a regular navigation arms the guard', async ({ page }) => {
		// Proves the recorder can see the guard's short isLoading pulse, so the
		// shallow test above can't pass just because the pulse went unnoticed.
		const states = await recordIsLoading(page, async () => {
			await page.locator('[data-testid="regular-nav"]').click();
			await page.waitForURL(/panel=regular/);
		});

		expect(states.some((s) => s.includes('true'))).toBe(true);
		await expect(page.locator('[data-testid="is-loading"]')).toContainText('false');
	});
});
