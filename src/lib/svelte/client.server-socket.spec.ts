// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'svelte/server';
import { createAuthClient } from 'better-auth/svelte';
import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { closeConvex } from 'convex-svelte/sveltekit';

import ServerSocketHarness from './ServerSocketHarness.spec.svelte';

vi.mock('$app/navigation', () => ({ beforeNavigate: vi.fn() }));

// Regression: createSvelteAuthClient used to pass `disabled: false` to
// setupConvex, which made the ConvexClient it creates during SSR (apps without
// initConvex) open a WebSocket on the server that lived as long as the process.
// convex-svelte is real here; only the WebSocket constructor is replaced.

describe('createSvelteAuthClient during SSR without initConvex()', () => {
	afterEach(async () => {
		vi.unstubAllGlobals();
		await closeConvex();
	});

	it('creates a disabled ConvexClient and opens no WebSocket', () => {
		const opened: string[] = [];
		vi.stubGlobal(
			'WebSocket',
			class {
				readyState = 0;
				constructor(url: string) {
					opened.push(url);
				}
				close() {}
				send() {}
			}
		);
		const authClient = createAuthClient({
			baseURL: 'https://app.example.com',
			plugins: [convexClient()]
		});
		let disabled: boolean | undefined;

		void render(ServerSocketHarness, {
			props: { authClient, onClient: (value: boolean) => (disabled = value) }
		}).body;

		expect(disabled).toBe(true);
		expect(opened).toEqual([]);
	});
});
