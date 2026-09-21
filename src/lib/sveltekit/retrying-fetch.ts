import isNetworkError from 'is-network-error';

import { isTransientStatus } from '../svelte/fetch-token.js';

/**
 * Convex HTTP endpoints that answer queries. Only these are retried: a query
 * is a read, so repeating it can only cost an extra round trip. `/api/mutation`
 * and `/api/action` are deliberately absent, because a lost response does not
 * prove the write did not commit, and a blind repeat would run it twice.
 */
const RETRYABLE_PATHS = ['/api/query', '/api/query_ts', '/api/query_at_ts'];

/**
 * Status Convex answers with when the function itself threw (see
 * `STATUS_CODE_UDF_FAILED` in convex/browser). The request reached the
 * deployment and the outcome is deterministic, so a repeat would only run the
 * failing query again and delay the error.
 */
const STATUS_CODE_UDF_FAILED = 560;

/**
 * Pathname of a `fetch` input, which may be a string, a `URL` or a `Request`.
 * The base only exists so that a relative URL can be parsed at all; it never
 * influences the pathname.
 */
const getPathname = (input: RequestInfo | URL): string | undefined => {
	const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
	try {
		return new URL(url, 'http://localhost').pathname;
	} catch {
		return undefined;
	}
};

const isQueryRequest = (input: RequestInfo | URL): boolean => {
	const pathname = getPathname(input);
	return pathname !== undefined && RETRYABLE_PATHS.some((path) => pathname.endsWith(path));
};

/**
 * Wrap a `fetch` so that Convex query requests survive a transient failure.
 *
 * A proxy in front of Convex answers 502 for a second during a deploy, which
 * turns a single-attempt SSR load into a thrown error. Query requests are
 * repeated on a network error or a transient status (408, 429, 5xx except
 * Convex's 560 for a function that threw); every
 * other request, status and error is passed through untouched. With the
 * defaults an SSR load waits about a second before it gives up and returns the
 * last response or rethrows the last error.
 *
 * @param baseFetch - The `fetch` that performs the actual request.
 * @param options.maxRetries - Retries after the first attempt. Defaults to 2.
 * @param options.initialBackoffMs - Backoff before the first retry, doubled for
 * each further retry. Defaults to 250.
 * @param options.maxBackoffMs - Upper bound for a single backoff. Defaults to 500.
 * @param options.logVerbose - Called before each retry.
 */
export const createRetryingFetch = (
	baseFetch: typeof globalThis.fetch,
	options: {
		maxRetries?: number;
		initialBackoffMs?: number;
		maxBackoffMs?: number;
		logVerbose?: (message: string) => void;
	} = {}
): typeof globalThis.fetch => {
	const maxRetries = options.maxRetries ?? 2;
	const initialBackoff = options.initialBackoffMs ?? 250;
	const maxBackoff = options.maxBackoffMs ?? 500;
	const logVerbose = options.logVerbose ?? (() => {});

	return async (input, init) => {
		if (!isQueryRequest(input)) {
			return baseFetch(input, init);
		}

		let retries = 0;

		const nextBackoff = () => {
			const baseBackoff = initialBackoff * Math.pow(2, retries);
			retries += 1;
			const actualBackoff = Math.min(baseBackoff, maxBackoff);
			const jitter = actualBackoff * (Math.random() - 0.5);
			return actualBackoff + jitter;
		};

		for (;;) {
			let failure: string;
			try {
				const response = await baseFetch(input, init);
				if (response.status === STATUS_CODE_UDF_FAILED || !isTransientStatus(response.status)) {
					return response;
				}
				if (retries >= maxRetries) {
					logVerbose(`query request failed with status ${response.status}, giving up`);
					return response;
				}
				failure = `status ${response.status}`;
				// Release the connection of the response that is being discarded.
				await response.body?.cancel().catch(() => {});
			} catch (e) {
				if (!isNetworkError(e) || retries >= maxRetries) {
					throw e;
				}
				failure = 'network error';
			}

			const backoff = nextBackoff();
			logVerbose(`query request failed with ${failure}, retrying in ${backoff}ms`);
			await new Promise((resolve) => setTimeout(resolve, backoff));
		}
	};
};
