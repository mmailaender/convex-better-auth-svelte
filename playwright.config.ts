import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from .env.test
 */
import { config } from 'dotenv';
config({ path: '.env.test' });

export default defineConfig({
	testDir: './e2e',
	/* Run tests in files in parallel */
	fullyParallel: true,
	/* Fail the build on CI if you accidentally left test.only in the source code */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* Opt out of parallel tests on CI */
	workers: process.env.CI ? 1 : undefined,
	/* Reporter to use */
	reporter: 'html',
	/* Shared settings for all the projects below */
	use: {
		/* Base URL to use in actions like `await page.goto('/')` */
		baseURL: 'http://localhost:5173',
		/* Collect trace when retrying the failed test */
		trace: 'on-first-retry'
	},

	/* Configure projects for major browsers */
	projects: [
		// Setup project - authenticates and saves state
		{
			name: 'setup',
			testMatch: /.*\.setup\.ts/
		},
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				// Use stored auth state
				storageState: 'e2e/.auth/user.json'
			},
			dependencies: ['setup']
		}
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		command: 'pnpm run dev:frontend',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000
	}
});
