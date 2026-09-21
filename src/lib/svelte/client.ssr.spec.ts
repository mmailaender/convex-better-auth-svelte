// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'svelte/server';
import { createAuthClient } from 'better-auth/svelte';
import { convexClient } from '@convex-dev/better-auth/client/plugins';

vi.mock('$env/static/public', () => ({
	PUBLIC_CONVEX_URL: 'https://convex.example.com'
}));

vi.mock('$app/navigation', () => ({
	beforeNavigate: vi.fn()
}));

vi.mock('convex-svelte', () => ({
	setupConvex: vi.fn(),
	setupAuth: vi.fn(),
	setConvexClientContext: vi.fn(),
	_authContextKey: Symbol('auth')
}));

import ClientSsrHarness from './ClientSsrHarness.spec.svelte';

// ---------------------------------------------------------------------------
// The Better Auth client is module-scoped, so it outlives every server render.
// A subscription that createSvelteAuthClient adds without releasing it stays on
// the client's atoms, together with the per-render state its callback captures,
// for the lifetime of the server process.
// ---------------------------------------------------------------------------

describe('createSvelteAuthClient during SSR', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('releases its Better Auth subscriptions when the render completes', () => {
		const authClient = createAuthClient({
			baseURL: 'https://app.example.com',
			plugins: [convexClient()]
		});
		const { $sessionSignal, session } = authClient.$store.atoms;
		const listenersBefore = { signal: $sessionSignal.lc, session: session.lc };
		vi.useFakeTimers();

		for (let request = 0; request < 20; request++) {
			// render() is lazy: the component only runs once the output is read.
			void render(ClientSsrHarness, { props: { authClient } }).body;
		}

		expect(session.lc).toBe(listenersBefore.session);

		// While mounted, the session atom listens to the signal itself; nanostores
		// releases that listener one second after the last subscriber is gone.
		vi.advanceTimersByTime(1000);
		expect($sessionSignal.lc).toBe(listenersBefore.signal);
	});
});
