import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchTokenBrowser, type ConvexTokenClient } from './fetch-token.js';

// ---------------------------------------------------------------------------
// fetchTokenBrowser classifies failures of authClient.convex.token():
//
// - The Better Auth client resolves with { data, error } on HTTP error
//   statuses (throw is opt-in), so HTTP failures arrive as `error`, not as
//   thrown exceptions.
// - Definitive 4xx (401/403) mean the session is gone → return null so the
//   Convex AuthenticationManager reports unauthenticated.
// - Transient failures (5xx, 408, 429, network errors) are retried with
//   backoff. Returning null for those would sign the user out of live
//   queries after a single failed refresh, e.g. a 502 during a deploy.
// ---------------------------------------------------------------------------

const noop = () => {};

type TokenResult = Awaited<ReturnType<ConvexTokenClient['convex']['token']>>;

/** Builds a client whose token() call plays back the given results in order. */
function clientWithResults(results: (TokenResult | Error)[]): {
	client: ConvexTokenClient;
	token: ReturnType<typeof vi.fn>;
} {
	let call = 0;
	const token = vi.fn(async (): Promise<TokenResult> => {
		const result = results[Math.min(call, results.length - 1)];
		call += 1;
		if (result instanceof Error) throw result;
		return result;
	});
	return { client: { convex: { token } }, token };
}

const ok = (token: string): TokenResult => ({ data: { token }, error: null });
const httpError = (status: number): TokenResult => ({ data: null, error: { status } });

/** TypeError('Failed to fetch') is what is-network-error recognizes. */
const networkError = () => new TypeError('Failed to fetch');

async function runWithTimers<T>(promise: Promise<T>): Promise<T> {
	// Flush the backoff timers until the promise settles.
	let settled = false;
	const tracked = promise.finally(() => {
		settled = true;
	});
	// Prevent unhandled rejection warnings while timers advance.
	tracked.catch(noop);
	while (!settled) {
		await vi.advanceTimersByTimeAsync(2000);
	}
	return tracked;
}

describe('fetchTokenBrowser', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns the token on first success', async () => {
		const { client, token } = clientWithResults([ok('jwt-1')]);
		await expect(fetchTokenBrowser(client, noop)).resolves.toBe('jwt-1');
		expect(token).toHaveBeenCalledTimes(1);
	});

	it('returns null when the response has no token and no error', async () => {
		const { client, token } = clientWithResults([{ data: null, error: null }]);
		await expect(fetchTokenBrowser(client, noop)).resolves.toBeNull();
		expect(token).toHaveBeenCalledTimes(1);
	});

	it('returns null without retrying on 401 (session gone)', async () => {
		const { client, token } = clientWithResults([httpError(401)]);
		await expect(fetchTokenBrowser(client, noop)).resolves.toBeNull();
		expect(token).toHaveBeenCalledTimes(1);
	});

	it('returns null without retrying on 403 (session revoked)', async () => {
		const { client, token } = clientWithResults([httpError(403)]);
		await expect(fetchTokenBrowser(client, noop)).resolves.toBeNull();
		expect(token).toHaveBeenCalledTimes(1);
	});

	it('returns null without retrying on other definitive 4xx (misconfiguration)', async () => {
		const { client, token } = clientWithResults([httpError(404)]);
		await expect(fetchTokenBrowser(client, noop)).resolves.toBeNull();
		expect(token).toHaveBeenCalledTimes(1);
	});

	it('retries a 502 during a deploy and recovers', async () => {
		const { client, token } = clientWithResults([httpError(502), httpError(502), ok('jwt-2')]);
		await expect(runWithTimers(fetchTokenBrowser(client, noop))).resolves.toBe('jwt-2');
		expect(token).toHaveBeenCalledTimes(3);
	});

	it('retries 500, 429 and 408 responses', async () => {
		for (const status of [500, 429, 408]) {
			const { client, token } = clientWithResults([httpError(status), ok('jwt-3')]);
			await expect(runWithTimers(fetchTokenBrowser(client, noop))).resolves.toBe('jwt-3');
			expect(token).toHaveBeenCalledTimes(2);
		}
	});

	it('retries when the error carries no status', async () => {
		const { client, token } = clientWithResults([{ data: null, error: {} }, ok('jwt-4')]);
		await expect(runWithTimers(fetchTokenBrowser(client, noop))).resolves.toBe('jwt-4');
		expect(token).toHaveBeenCalledTimes(2);
	});

	it('gives up with null after persistent server errors', async () => {
		const { client, token } = clientWithResults([httpError(503)]);
		await expect(runWithTimers(fetchTokenBrowser(client, noop))).resolves.toBeNull();
		expect(token.mock.calls.length).toBeGreaterThan(10);
	});

	it('retries network errors and recovers (existing behavior)', async () => {
		const { client, token } = clientWithResults([networkError(), ok('jwt-5')]);
		await expect(runWithTimers(fetchTokenBrowser(client, noop))).resolves.toBe('jwt-5');
		expect(token).toHaveBeenCalledTimes(2);
	});

	it('throws after persistent network errors (existing behavior)', async () => {
		const { client } = clientWithResults([networkError()]);
		await expect(runWithTimers(fetchTokenBrowser(client, noop))).rejects.toThrow('Failed to fetch');
	});

	it('returns null on non-network exceptions (existing behavior)', async () => {
		const { client, token } = clientWithResults([new Error('boom')]);
		await expect(fetchTokenBrowser(client, noop)).resolves.toBeNull();
		expect(token).toHaveBeenCalledTimes(1);
	});
});
