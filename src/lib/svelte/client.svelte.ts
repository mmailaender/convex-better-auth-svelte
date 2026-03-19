import { getContext, setContext, onMount } from 'svelte';

import {
	setupConvex,
	setupAuth,
	setConvexClientContext,
	_authContextKey
} from '@mmailaender/convex-svelte';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { beforeNavigate } from '$app/navigation';

import type { ConvexClient, ConvexClientOptions } from 'convex/browser';
import isNetworkError from 'is-network-error';
import type { BetterAuthClientOptions, BetterAuthClientPlugin } from 'better-auth';
import type { createAuthClient } from 'better-auth/svelte';
import type { crossDomainClient, convexClient } from '@convex-dev/better-auth/client/plugins';

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

type CrossDomainClient = ReturnType<typeof crossDomainClient>;
type ConvexClientBetterAuth = ReturnType<typeof convexClient>;
type PluginsWithCrossDomain = (
	| CrossDomainClient
	| ConvexClientBetterAuth
	| BetterAuthClientPlugin
)[];
type PluginsWithoutCrossDomain = (ConvexClientBetterAuth | BetterAuthClientPlugin)[];
type AuthClientWithPlugins<Plugins extends PluginsWithCrossDomain | PluginsWithoutCrossDomain> =
	ReturnType<
		typeof createAuthClient<
			BetterAuthClientOptions & {
				plugins: Plugins;
			}
		>
	>;
export type AuthClient =
	| AuthClientWithPlugins<PluginsWithCrossDomain>
	| AuthClientWithPlugins<PluginsWithoutCrossDomain>;

type ExtractSessionState<T> = T extends {
	subscribe(fn: (state: infer S) => void): unknown;
}
	? S
	: never;
type SessionState = ExtractSessionState<ReturnType<AuthClient['useSession']>>;

type FetchAccessToken = (options: { forceRefreshToken: boolean }) => Promise<string | null>;

// Context key for sharing auth client and functions
const AUTH_CONTEXT_KEY = Symbol('auth-context');

type BetterAuthContext = {
	authClient: AuthClient;
	fetchAccessToken: FetchAccessToken;
};

type ExternalSession = {
	/**
	 * Return a Better Auth credential that can be exchanged for a Convex JWT.
	 *
	 * This is typically:
	 * - a device authorization access token (e.g. from the Better Auth deviceAuthorization plugin),
	 * - or an API key / session token used by a CLI or other non-browser client.
	 *
	 * The returned value will be sent as:
	 *
	 *   Authorization: Bearer <token>
	 *
	 * to the Better Auth Convex plugin's `/convex/token` endpoint.
	 */
	getAccessToken: () => string | null | Promise<string | null>;
};

/**
 * Initial auth state from server for SSR.
 * Used to avoid loading flash on initial page render.
 */
export type InitialAuthState = {
	isAuthenticated: boolean;
};

type CreateSvelteAuthClientBaseArgs = {
	authClient: AuthClient;
	convexUrl?: string;
	convexClient?: ConvexClient;
	options?: ConvexClientOptions;
	/**
	 * Optional getter for server-side auth state.
	 * When provided, the auth state will be initialized with the server state
	 * to avoid loading flash on initial render.
	 *
	 * @example
	 * ```svelte
	 * <!-- +layout.svelte -->
	 * <script lang="ts">
	 *   let { children, data } = $props();
	 *
	 *   createSvelteAuthClient({
	 *     authClient,
	 *     getServerState: () => data.authState
	 *   });
	 * </script>
	 * ```
	 */
	getServerState?: () => InitialAuthState | undefined;
};

type CreateSvelteAuthClientExternalArgs = CreateSvelteAuthClientBaseArgs & {
	externalSession: ExternalSession;
};

/* -------------------------------------------------------------------------- */
/*                          Public entrypoint                                 */
/* -------------------------------------------------------------------------- */

/**
 * Create a Convex + Better Auth integration for Svelte apps.
 *
 * This function wires:
 * - Better Auth (browser or external flows),
 * - the Convex client,
 * - and an auth state (`isLoading`, `isAuthenticated`, `fetchAccessToken`)
 *   into a single integration that you can consume via `useAuth()`.
 *
 * ## Browser flow (cookies + useSession)
 *
 * In a standard web app, you typically call:
 *
 * ```ts
 * import { authClient } from '$lib/auth-client';
 *
 * createSvelteAuthClient({
 *   authClient,
 *   convexUrl: PUBLIC_CONVEX_URL,
 * });
 * ```
 *
 * In this mode, `createSvelteAuthClient`:
 * - uses `authClient.useSession()` as the auth-provider source of truth,
 * - calls `authClient.convex.token()` using the Better Auth session cookie
 *   to obtain a Convex JWT,
 * - and sets `convexClient.setAuth(...)` accordingly.
 *
 * ## External session flow (deviceAuthorization, API keys, CLIs)
 *
 * For environments that **do not** rely on browser cookies (e.g. Figma plugins,
 * CLI tools, or any environment where you only have an access token / API key),
 * you can provide an `externalSession`:
 *
 * ```ts
 * const authClient = createAuthClient({
 *   baseURL: import.meta.env.VITE_SITE_URL,
 *   plugins: [convexClient()],
 * });
 *
 * createSvelteAuthClient({
 *   authClient,
 *   convexClient,
 *   convexUrl: PUBLIC_CONVEX_URL,
 *   externalSession: {
 *     getAccessToken: () => deviceAccessToken, // or async lookup
 *   },
 * });
 * ```
 *
 * In this mode, `createSvelteAuthClient`:
 * - calls `externalSession.getAccessToken()` when Convex requests a token,
 * - sends that token as `Authorization: Bearer <token>` to the
 *   Better Auth Convex plugin's `/convex/token` endpoint,
 * - uses a successful response as the signal that the user is authenticated
 *   from the auth-provider viewpoint,
 * - and still manages `convexClient.setAuth` / `clearAuth` and the combined
 *   `isLoading` / `isAuthenticated` state.
 */
export function createSvelteAuthClient({
	authClient,
	convexUrl,
	convexClient,
	options,
	externalSession,
	getServerState
}: CreateSvelteAuthClientBaseArgs & { externalSession?: ExternalSession }) {
	if (externalSession) {
		// External / headless flow (device auth, API keys, CLIs, Figma, etc.)
		return createSvelteAuthClientExternal({
			authClient,
			convexUrl,
			convexClient,
			options,
			externalSession
		});
	}

	// Default: browser flow with Better Auth session cookies
	return createSvelteAuthClientBrowser({
		authClient,
		convexUrl,
		convexClient,
		options,
		getServerState
	});
}

/* -------------------------------------------------------------------------- */
/*                        Shared internal helpers                             */
/* -------------------------------------------------------------------------- */

const resolveConvexClient = (
	convexUrl: string | undefined,
	passedConvexClient: ConvexClient | undefined,
	options?: ConvexClientOptions
): void => {
	if (passedConvexClient) {
		setConvexClientContext(passedConvexClient);
	} else {
		const url = convexUrl ?? PUBLIC_CONVEX_URL;
		setupConvex(url, { disabled: false, ...options });
	}
};

/* -------------------------------------------------------------------------- */
/*                     Browser / cookie-based integration                      */
/* -------------------------------------------------------------------------- */

function createSvelteAuthClientBrowser({
	authClient,
	convexUrl,
	convexClient: passedConvexClient,
	options,
	getServerState
}: CreateSvelteAuthClientBaseArgs) {
	// 1. Resolve Convex client (setupConvex / setConvexClientContext)
	resolveConvexClient(convexUrl, passedConvexClient, options);

	// 2. Subscribe to Better Auth session state → reactive $state
	let sessionData: SessionState['data'] | null = $state(null);
	let sessionPending: boolean = $state(true);

	// Guard: during SvelteKit client-side navigation, the Better Auth session
	// atom can briefly emit { data: null, isPending: false } before re-settling.
	// setupAuth requires the not-authenticated transition to go through a loading
	// phase first (isConvexAuthenticated: true → null → false).  This guard
	// ensures that by temporarily reporting pending when a previously authenticated
	// session suddenly becomes { null, false }.  A short timeout confirms the
	// real state — navigation transients resolve well within 150ms, while real
	// sign-outs proceed after the timeout fires.
	let wasAuthenticated = false;
	let transientGuardTimer: ReturnType<typeof setTimeout> | null = null;

	// Bridge the gap between auth operations and session atom updates.
	// Better Auth uses a 10ms setTimeout before toggling $sessionSignal
	// (see proxy.mjs), which means the session atom doesn't start refetching
	// until ~10ms after signIn/signUp completes.  During this gap, goto()
	// can navigate to a new page with stale auth state, causing a flash of
	// unauthenticated content.  We set sessionPending=true during navigation
	// when the session is not yet established, giving the atom time to settle.
	let navigationPendingTimer: ReturnType<typeof setTimeout> | null = null;

	beforeNavigate(({ willUnload }) => {
		if (!willUnload && !sessionData) {
			sessionPending = true;
			if (navigationPendingTimer) clearTimeout(navigationPendingTimer);
			navigationPendingTimer = setTimeout(() => {
				navigationPendingTimer = null;
				sessionPending = false;
			}, 50);
		}
	});

	// Prevent stale token fetches during sign-out (and other auth operations).
	// Better Auth's proxy toggles $sessionSignal via setTimeout(10ms) after an
	// auth request succeeds.  Between the cookie being cleared (sign-out response)
	// and the session atom settling with null data, the Convex client's scheduled
	// token refresh can fire and hit the token endpoint → 401.
	//
	// However, $sessionSignal is ALSO toggled on tab refocus by session-refresh.mjs.
	// Immediately returning null when the flag is set would block valid token
	// fetches on tab refocus → Convex AuthenticationManager reports onChange(false)
	// → auth flash.  Instead, fetchAccessToken awaits the settling promise, then
	// re-checks the session: still valid → proceed (tab refocus), cleared → skip
	// (sign-out, no 401).
	let authOperationPending = false;
	let signalInitialized = false;
	let authOpSettledResolve: (() => void) | null = null;
	let authOpSettledPromise: Promise<void> | null = null;

	authClient.$store.listen('$sessionSignal', () => {
		if (!signalInitialized) {
			signalInitialized = true;
			return;
		}
		if (sessionData) {
			authOperationPending = true;
			authOpSettledPromise = new Promise<void>((resolve) => {
				authOpSettledResolve = resolve;
			});
		}
	});

	authClient.useSession().subscribe((session: SessionState) => {
		if (navigationPendingTimer) {
			clearTimeout(navigationPendingTimer);
			navigationPendingTimer = null;
		}

		// Detect whether a known auth operation (sign-out, etc.) is settling.
		// We must capture this BEFORE clearing the flag, so the transient guard
		// below can distinguish a real sign-out from a transient navigation glitch.
		const isRefetching = (session as Record<string, unknown>).isRefetching as boolean;
		const isAuthOpSettling = authOperationPending && !isRefetching;
		if (isAuthOpSettling) {
			authOperationPending = false;
			if (authOpSettledResolve) {
				authOpSettledResolve();
				authOpSettledResolve = null;
			}
			authOpSettledPromise = null;
		}

		if (transientGuardTimer) {
			clearTimeout(transientGuardTimer);
			transientGuardTimer = null;
		}

		if (session.data) {
			wasAuthenticated = true;
		}

		if (wasAuthenticated && !session.data && !session.isPending) {
			sessionData = null;

			if (isAuthOpSettling) {
				// Known auth operation (e.g. sign-out) — the null session is real.
				// Skip the transient guard to avoid an isLoading flicker.
				sessionPending = false;
				wasAuthenticated = false;
			} else {
				// Unknown origin — could be a transient glitch during navigation.
				// Guard by temporarily reporting loading, then clear after 150ms.
				sessionPending = true;
				transientGuardTimer = setTimeout(() => {
					transientGuardTimer = null;
					sessionPending = false;
				}, 150);
			}
			return;
		}

		sessionData = session.data;
		sessionPending = session.isPending;
	});

	const logVerbose = (message: string) => {
		if (options?.verbose) {
			console.debug(`${new Date().toISOString()} ${message}`);
		}
	};

	const fetchAccessToken = makeFetchAccessTokenBrowser(
		authClient,
		() => sessionData,
		() => authOperationPending,
		() => authOpSettledPromise,
		logVerbose
	);

	// 3. Delegate entire auth state machine to setupAuth
	const serverState = getServerState?.();
	setupAuth(
		() => ({
			isLoading: sessionPending,
			isAuthenticated: !!sessionData,
			fetchAccessToken
		}),
		serverState ? { initialState: { isAuthenticated: serverState.isAuthenticated } } : undefined
	);

	// 4. Set additional context for our enhanced useAuth (fetchAccessToken)
	setContext<BetterAuthContext>(AUTH_CONTEXT_KEY, { authClient, fetchAccessToken });

	// 5. Handle one-time token verification
	onMount(() => {
		handleOneTimeToken(authClient);
	});
}

/* -------------------------------------------------------------------------- */
/*                     External / headless integration                         */
/* -------------------------------------------------------------------------- */

/**
 * External / headless Better Auth + Convex integration.
 *
 * This is used when you have an externalSession (device authorization) and do not rely on Better Auth's browser session cookies.
 */
function createSvelteAuthClientExternal({
	authClient,
	convexUrl,
	convexClient: passedConvexClient,
	options,
	externalSession
}: CreateSvelteAuthClientExternalArgs) {
	// 1. Resolve Convex client
	resolveConvexClient(convexUrl, passedConvexClient, options);

	const logVerbose = (message: string) => {
		if (options?.verbose) {
			console.debug(`${new Date().toISOString()} ${message}`);
		}
	};

	const fetchAccessToken = makeFetchAccessTokenExternal(authClient, externalSession, logVerbose);

	// 2. Delegate auth state machine to setupAuth.
	//    For external flow: always attempt authentication, let backend confirm.
	setupAuth(() => ({
		isLoading: false,
		isAuthenticated: true,
		fetchAccessToken
	}));

	// 3. Set additional context for our enhanced useAuth (fetchAccessToken)
	setContext<BetterAuthContext>(AUTH_CONTEXT_KEY, { authClient, fetchAccessToken });
}

/* -------------------------------------------------------------------------- */
/*                     Top-level fetchAccessToken helpers                      */
/* -------------------------------------------------------------------------- */

const makeFetchAccessTokenBrowser = (
	authClient: AuthClient,
	getSessionData: () => SessionState['data'] | null,
	getAuthOperationPending: () => boolean,
	getAuthOpSettledPromise: () => Promise<void> | null,
	logVerbose: (message: string) => void
): FetchAccessToken => {
	// Track whether the session atom has ever reported data.
	// Before it has, we allow token fetches even though getSessionData()
	// is null — the browser cookies are valid during initial hydration,
	// and the null session simply means the atom hasn't settled yet.
	// Once the session has been available and then clears (sign-out),
	// we skip fetches to avoid 401s.
	let sessionHasBeenAvailable = false;

	return async ({ forceRefreshToken }) => {
		if (!forceRefreshToken) return null;

		const currentSession = getSessionData();
		if (currentSession) {
			sessionHasBeenAvailable = true;
		}

		// Skip the HTTP request when the session was previously available
		// and is now cleared (e.g. after sign-out).  During initial hydration
		// (sessionHasBeenAvailable === false), the cookies are still valid
		// even though the session atom hasn't loaded yet.
		if (sessionHasBeenAvailable && !currentSession) {
			logVerbose('browser: session cleared, skipping token fetch');
			return null;
		}

		// When an auth-affecting signal ($sessionSignal) has fired, wait for
		// the session atom to settle before deciding.  This signal is shared
		// between auth operations (sign-out via proxy.mjs) and tab-refocus
		// refetches (session-refresh.mjs).  Immediately returning null would
		// block valid token fetches on tab refocus → auth flash.  Instead we
		// wait, then re-check: session survived → proceed (tab refocus),
		// session cleared → skip (sign-out, no 401).
		if (getAuthOperationPending()) {
			logVerbose('browser: auth operation pending, waiting for session to settle');
			const settledPromise = getAuthOpSettledPromise();
			if (settledPromise) {
				await Promise.race([settledPromise, new Promise<void>((r) => setTimeout(r, 2000))]);
			}
			const sessionAfterSettle = getSessionData();
			if (sessionHasBeenAvailable && !sessionAfterSettle) {
				logVerbose('browser: session cleared after auth op settled, skipping token fetch');
				return null;
			}
			logVerbose('browser: session still valid after auth op settled, proceeding');
		}

		const token = await fetchTokenBrowser(authClient, logVerbose);
		logVerbose('browser: returning retrieved token');
		return token;
	};
};

const makeFetchAccessTokenExternal = (
	authClient: AuthClient,
	externalSession: ExternalSession,
	logVerbose: (message: string) => void
): FetchAccessToken => {
	return async () => {
		// For external flows we ignore forceRefreshToken and always try to
		// exchange the external credential for a Convex JWT.
		const rawToken = await externalSession.getAccessToken();
		if (!rawToken) {
			logVerbose('external: no access token');
			return null;
		}
		try {
			const { data } = await authClient.convex.token(undefined, {
				headers: {
					Authorization: `Bearer ${rawToken}`
				}
			});
			return data?.token ?? null;
		} catch (e) {
			if (!isNetworkError(e)) {
				throw e;
			}
			logVerbose('external: network error when fetching Convex JWT');
			return null;
		}
	};
};

/* -------------------------------------------------------------------------- */
/*                          Token helpers                                     */
/* -------------------------------------------------------------------------- */

const fetchTokenBrowser = async (
	authClient: AuthClient,
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

	const fetchWithRetry = async (): Promise<string | null> => {
		try {
			const { data } = await authClient.convex.token();
			return data?.token || null;
		} catch (e) {
			if (!isNetworkError(e)) {
				// Non-network errors (e.g. 401/403 after session expiry) mean
				// the session is gone — return null instead of throwing.
				logVerbose(`fetchToken failed with non-network error: ${e}`);
				return null;
			}
			if (retries > 10) {
				logVerbose(`fetchToken failed with network error, giving up`);
				throw e;
			}
			const backoff = nextBackoff();
			logVerbose(`fetchToken failed with network error, attempting retrying in ${backoff}ms`);
			await new Promise((resolve) => setTimeout(resolve, backoff));
			return fetchWithRetry();
		}
	};

	return fetchWithRetry();
};

// Handle one-time token verification (equivalent to useEffect)
const handleOneTimeToken = async (authClient: AuthClient) => {
	const url = new URL(window.location?.href);
	const token = url.searchParams.get('ott');
	if (token) {
		const authClientWithCrossDomain = authClient as AuthClientWithPlugins<PluginsWithCrossDomain>;
		url.searchParams.delete('ott');
		const result = await authClientWithCrossDomain.crossDomain.oneTimeToken.verify({
			token
		});
		const sessionData = result.data?.session;
		if (sessionData) {
			await authClient.getSession({
				fetchOptions: {
					headers: {
						Authorization: `Bearer ${sessionData.token}`
					}
				}
			});
			authClientWithCrossDomain.updateSession();
		}
		window.history.replaceState({}, '', url);
	}
};

/* -------------------------------------------------------------------------- */
/*                               useAuth hook                                 */
/* -------------------------------------------------------------------------- */

// _authContextKey is imported from @mmailaender/convex-svelte (set by setupAuth)

/**
 * Hook to access authentication state and functions.
 * Must be used within a component that has createSvelteAuthClient called in its parent tree.
 *
 * Returns a superset of `useAuth()` from `@mmailaender/convex-svelte`:
 * - `isLoading` / `isAuthenticated` — from the base library's setupAuth context
 * - `fetchAccessToken` — Better Auth-specific, for manually fetching a Convex JWT
 */
export const useAuth = (): {
	isLoading: boolean;
	isAuthenticated: boolean;
	fetchAccessToken: FetchAccessToken;
} => {
	const baseAuthContext = getContext<{ isLoading: boolean; isAuthenticated: boolean } | undefined>(
		_authContextKey
	);
	const betterAuthContext = getContext<BetterAuthContext | undefined>(AUTH_CONTEXT_KEY);

	if (!baseAuthContext || !betterAuthContext) {
		throw new Error(
			'useAuth must be used within a component that has createSvelteAuthClient called in its parent tree'
		);
	}

	return {
		get isLoading() {
			return baseAuthContext.isLoading;
		},
		get isAuthenticated() {
			return baseAuthContext.isAuthenticated;
		},
		fetchAccessToken: betterAuthContext.fetchAccessToken
	};
};
