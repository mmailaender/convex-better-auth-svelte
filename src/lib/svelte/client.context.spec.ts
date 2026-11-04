// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { setContext } from 'svelte';
import { render } from 'svelte/server';
import { createAuthClient } from 'better-auth/svelte';
import { convexClient } from '@convex-dev/better-auth/client/plugins';

const { authContextKey } = vi.hoisted(() => ({ authContextKey: Symbol('auth') }));

vi.mock('convex-svelte/sveltekit', () => ({
	getConvexUrl: () => 'https://convex.example.com'
}));

vi.mock('$app/navigation', () => ({
	beforeNavigate: vi.fn()
}));

vi.mock('convex-svelte', () => ({
	setupConvex: vi.fn(),
	setupAuth: () => setContext(authContextKey, { isLoading: true, isAuthenticated: false }),
	setConvexClientContext: vi.fn(),
	_authContextKey: authContextKey
}));

import ContextHarness from './ContextHarness.spec.svelte';

describe('useAuth', () => {
	// Vite's dev SSR runner can evaluate this module more than once during a
	// request, after a plugin invalidates part of the module graph.
	it('finds a provider created by another evaluation of the module', async () => {
		const authClient = createAuthClient({
			baseURL: 'https://app.example.com',
			plugins: [convexClient()]
		});
		const secondEvaluation: string = './client.svelte.js?evaluation=2';
		const { useAuth }: typeof import('./client.svelte.js') = await import(
			/* @vite-ignore */ secondEvaluation
		);

		expect(() => render(ContextHarness, { props: { authClient, useAuth } }).body).not.toThrow();
	});
});
