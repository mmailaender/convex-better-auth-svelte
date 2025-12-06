import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		// Unit tests
		include: ['src/**/*.{test,spec}.{js,ts}'],
		exclude: ['e2e/**/*'],

		// Environment
		environment: 'jsdom',

		// Setup files
		setupFiles: ['./vitest-setup-client.ts']
	}
});
