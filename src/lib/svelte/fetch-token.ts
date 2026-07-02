import isNetworkError from 'is-network-error';

/**
 * Minimal structural view of the Better Auth client used by
 * {@link fetchTokenBrowser}. The real client's `convex.token()` resolves with
 * `{ data, error }` and only throws on network-level failures (the Better Auth
 * client does not use `throw: true`).
 */
export type ConvexTokenClient = {
	convex: {
		token: () => Promise<{
			data: { token?: string | null } | null;
			error: { status?: number } | null;
		}>;
	};
};

/**
 * HTTP statuses that indicate a transient server-side failure (a deploy or
 * restart behind a proxy, a timeout, a rate limit) rather than an invalidated
 * session. These are retried with the same backoff as network errors. A
 * missing status is treated as transient because it carries no evidence that
 * the session is gone.
 */
const isTransientStatus = (status: number | undefined): boolean =>
	status === undefined || status === 408 || status === 429 || status >= 500;

/**
 * Fetch a Convex JWT via the Better Auth client, retrying transient failures.
 *
 * Returning `null` tells the Convex `AuthenticationManager` that the user is
 * definitively unauthenticated; it reports `onChange(false)` and stops without
 * retrying. So `null` must only be returned when the session is actually gone
 * (401/403 and other definitive 4xx), never for a transient server error,
 * otherwise a single 502 during a deploy signs the user out of live queries
 * until a full reload.
 */
export const fetchTokenBrowser = async (
	authClient: ConvexTokenClient,
	logVerbose: (message: string) => void
): Promise<string | null> => {
	const initialBackoff = 100;
	const maxBackoff = 1000;
	let retries = 0;

	const nextBackoff = () => {
		const baseBackoff = initialBackoff * Math.pow(2, retries);
		retries += 1;
		const actualBackoff = Math.min(baseBackoff, maxBackoff);
		const jitter = actualBackoff * (Math.random() - 0.5);
		return actualBackoff + jitter;
	};

	const retryAfterBackoff = async (failure: string): Promise<string | null> => {
		const backoff = nextBackoff();
		logVerbose(`fetchToken failed with ${failure}, retrying in ${backoff}ms`);
		await new Promise((resolve) => setTimeout(resolve, backoff));
		return fetchWithRetry();
	};

	const fetchWithRetry = async (): Promise<string | null> => {
		let result: Awaited<ReturnType<ConvexTokenClient['convex']['token']>>;
		try {
			result = await authClient.convex.token();
		} catch (e) {
			if (!isNetworkError(e)) {
				logVerbose(`fetchToken failed with non-network error: ${e}`);
				return null;
			}
			if (retries > 10) {
				logVerbose(`fetchToken failed with network error, giving up`);
				throw e;
			}
			return retryAfterBackoff('network error');
		}
		const { data, error } = result;
		if (!error) {
			return data?.token || null;
		}
		// The Better Auth client resolves with { data: null, error } on HTTP
		// error statuses instead of throwing, so HTTP failures never reach the
		// catch above and must be classified here.
		if (!isTransientStatus(error.status)) {
			// A definitive 4xx (401/403 after session expiry or revocation)
			// means the session is gone — report unauthenticated.
			logVerbose(`fetchToken failed with status ${error.status}, session is gone`);
			return null;
		}
		if (retries > 10) {
			logVerbose(`fetchToken failed with status ${error.status}, giving up`);
			return null;
		}
		return retryAfterBackoff(`status ${error.status}`);
	};

	return fetchWithRetry();
};
