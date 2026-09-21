import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createRetryingFetch } from './retrying-fetch.js';

// ---------------------------------------------------------------------------
// createRetryingFetch repeats failed Convex query requests during SSR:
//
// - Only /api/query, /api/query_ts and /api/query_at_ts are repeated. A lost
//   mutation or action response does not prove the write did not commit, so
//   those are passed through on the first outcome.
// - Convex answers 560 when the query function itself throws. That outcome is
//   deterministic, so it is returned at once despite being a 5xx.
// - Transient statuses (5xx, 408, 429) and network errors are retried with
//   backoff; every other status and error is returned or rethrown unchanged.
// - Once the retry budget is spent, the last response is returned and the last
//   network error is rethrown, so the caller sees the real failure.
// ---------------------------------------------------------------------------

const noop = () => {};

const QUERY_URL = 'https://convex.example.com/api/query';

type FetchOutcome = Response | Error;

/** Builds a fetch whose calls play back the given outcomes in order. */
function fetchWithOutcomes(outcomes: FetchOutcome[]): ReturnType<typeof vi.fn> {
	let call = 0;
	return vi.fn(async (): Promise<Response> => {
		const outcome = outcomes[Math.min(call, outcomes.length - 1)];
		call += 1;
		if (outcome instanceof Error) throw outcome;
		return outcome;
	});
}

const status = (code: number) => new Response('{}', { status: code });
const ok = () => new Response('{"status":"success"}', { status: 200 });

/** TypeError('fetch failed') is what is-network-error recognizes on Node. */
const networkError = () => new TypeError('fetch failed');

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

describe('createRetryingFetch', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns the response of a successful query without retrying', async () => {
		const baseFetch = fetchWithOutcomes([ok()]);
		const retryingFetch = createRetryingFetch(baseFetch as unknown as typeof globalThis.fetch);

		const response = await retryingFetch(QUERY_URL, { method: 'POST' });

		expect(response.status).toBe(200);
		expect(baseFetch).toHaveBeenCalledTimes(1);
	});

	it('retries a query that hits a 502 during a deploy and recovers', async () => {
		const baseFetch = fetchWithOutcomes([status(502), ok()]);
		const retryingFetch = createRetryingFetch(baseFetch as unknown as typeof globalThis.fetch);

		const response = await runWithTimers(retryingFetch(QUERY_URL, { method: 'POST' }));

		expect(response.status).toBe(200);
		expect(baseFetch).toHaveBeenCalledTimes(2);
	});

	it('retries a query that fails with a network error and recovers', async () => {
		const baseFetch = fetchWithOutcomes([networkError(), ok()]);
		const retryingFetch = createRetryingFetch(baseFetch as unknown as typeof globalThis.fetch);

		const response = await runWithTimers(retryingFetch(QUERY_URL, { method: 'POST' }));

		expect(response.status).toBe(200);
		expect(baseFetch).toHaveBeenCalledTimes(2);
	});

	it('retries the query_ts and query_at_ts endpoints', async () => {
		for (const path of ['/api/query_ts', '/api/query_at_ts']) {
			const baseFetch = fetchWithOutcomes([status(503), ok()]);
			const retryingFetch = createRetryingFetch(baseFetch as unknown as typeof globalThis.fetch);

			const response = await runWithTimers(
				retryingFetch(`https://convex.example.com${path}`, { method: 'POST' })
			);

			expect(response.status).toBe(200);
			expect(baseFetch).toHaveBeenCalledTimes(2);
		}
	});

	it('does not retry a query that fails with 401', async () => {
		const baseFetch = fetchWithOutcomes([status(401), ok()]);
		const retryingFetch = createRetryingFetch(baseFetch as unknown as typeof globalThis.fetch);

		const response = await runWithTimers(retryingFetch(QUERY_URL, { method: 'POST' }));

		expect(response.status).toBe(401);
		expect(baseFetch).toHaveBeenCalledTimes(1);
	});

	it('does not retry a query whose function threw (560)', async () => {
		const baseFetch = fetchWithOutcomes([status(560), ok()]);
		const retryingFetch = createRetryingFetch(baseFetch as unknown as typeof globalThis.fetch);

		const response = await runWithTimers(retryingFetch(QUERY_URL, { method: 'POST' }));

		expect(response.status).toBe(560);
		expect(baseFetch).toHaveBeenCalledTimes(1);
	});

	it('does not retry a mutation that fails with 502', async () => {
		const baseFetch = fetchWithOutcomes([status(502), ok()]);
		const retryingFetch = createRetryingFetch(baseFetch as unknown as typeof globalThis.fetch);

		const response = await runWithTimers(
			retryingFetch('https://convex.example.com/api/mutation', { method: 'POST' })
		);

		expect(response.status).toBe(502);
		expect(baseFetch).toHaveBeenCalledTimes(1);
	});

	it('does not retry an action that fails with a network error', async () => {
		const baseFetch = fetchWithOutcomes([networkError(), ok()]);
		const retryingFetch = createRetryingFetch(baseFetch as unknown as typeof globalThis.fetch);

		await expect(
			runWithTimers(retryingFetch('https://convex.example.com/api/action', { method: 'POST' }))
		).rejects.toThrow('fetch failed');
		expect(baseFetch).toHaveBeenCalledTimes(1);
	});

	it('returns the last response once the retry budget is spent', async () => {
		const baseFetch = fetchWithOutcomes([status(502)]);
		const retryingFetch = createRetryingFetch(baseFetch as unknown as typeof globalThis.fetch, {
			maxRetries: 2
		});

		const response = await runWithTimers(retryingFetch(QUERY_URL, { method: 'POST' }));

		expect(response.status).toBe(502);
		expect(baseFetch).toHaveBeenCalledTimes(3);
	});

	it('rethrows the last network error once the retry budget is spent', async () => {
		const baseFetch = fetchWithOutcomes([networkError()]);
		const retryingFetch = createRetryingFetch(baseFetch as unknown as typeof globalThis.fetch, {
			maxRetries: 2
		});

		await expect(runWithTimers(retryingFetch(QUERY_URL, { method: 'POST' }))).rejects.toThrow(
			'fetch failed'
		);
		expect(baseFetch).toHaveBeenCalledTimes(3);
	});

	it('rethrows a non-network error without retrying', async () => {
		const baseFetch = fetchWithOutcomes([new Error('boom'), ok()]);
		const retryingFetch = createRetryingFetch(baseFetch as unknown as typeof globalThis.fetch);

		await expect(runWithTimers(retryingFetch(QUERY_URL, { method: 'POST' }))).rejects.toThrow(
			'boom'
		);
		expect(baseFetch).toHaveBeenCalledTimes(1);
	});

	it('classifies a Request input by its pathname', async () => {
		const queryFetch = fetchWithOutcomes([status(502), ok()]);
		const retryingQueryFetch = createRetryingFetch(
			queryFetch as unknown as typeof globalThis.fetch
		);

		const queryResponse = await runWithTimers(
			retryingQueryFetch(new Request(QUERY_URL, { method: 'POST' }))
		);

		expect(queryResponse.status).toBe(200);
		expect(queryFetch).toHaveBeenCalledTimes(2);

		const mutationFetch = fetchWithOutcomes([status(502), ok()]);
		const retryingMutationFetch = createRetryingFetch(
			mutationFetch as unknown as typeof globalThis.fetch
		);

		const mutationResponse = await runWithTimers(
			retryingMutationFetch(
				new Request('https://convex.example.com/api/mutation', { method: 'POST' })
			)
		);

		expect(mutationResponse.status).toBe(502);
		expect(mutationFetch).toHaveBeenCalledTimes(1);
	});
});
