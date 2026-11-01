import { isQueryRequest } from './retrying-fetch.js';

/**
 * Wrap a `fetch` so that a Convex query request fails after `timeoutMs`
 * instead of waiting on a stalled connection.
 *
 * `ConvexHttpClient` sets no deadline, and a connection that stalls before the
 * headers or halfway through the body neither throws nor returns a status. An
 * SSR load then waits until the runtime gives up, which on Node's fetch takes
 * 300 seconds. The deadline covers the whole attempt through the last body
 * byte and rejects with a `TimeoutError`, which `createRetryingFetch` does not
 * repeat, so a stall costs one deadline. A signal passed by the caller still
 * aborts the request. Mutations and actions are passed through untouched: they
 * may legitimately run longer, and aborting one does not undo its write.
 *
 * @param baseFetch - The `fetch` that performs the actual request.
 * @param timeoutMs - Deadline for one query attempt, in milliseconds.
 */
export const createQueryDeadlineFetch =
	(baseFetch: typeof globalThis.fetch, timeoutMs: number): typeof globalThis.fetch =>
	(input, init) => {
		if (!isQueryRequest(input)) {
			return baseFetch(input, init);
		}
		const deadline = AbortSignal.timeout(timeoutMs);
		const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
		const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
		return baseFetch(input, { ...init, signal });
	};
