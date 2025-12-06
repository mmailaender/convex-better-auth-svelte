import { getContext, setContext, onMount } from 'svelte';

import { PUBLIC_CONVEX_URL } from '$env/static/public';

import { setupConvex } from 'convex-svelte';

import type { ConvexClient, ConvexClientOptions } from 'convex/browser';
import isNetworkError from 'is-network-error';
import type { BetterAuthClientOptions, BetterAuthClientPlugin } from 'better-auth';
import type { createAuthClient } from 'better-auth/svelte';
import type { crossDomainClient, convexClient } from '@convex-dev/better-auth/client/plugins';

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

export type ConvexAuthClient = {
	verbose?: boolean;
	logger?: Exclude<NonNullable<ConvexClientOptions['logger']>, boolean>;
};

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

type AuthContext = {
	authClient: AuthClient;
	fetchAccessToken: FetchAccessToken;
	isLoading: boolean;
	isAuthenticated: boolean;
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
) => {
	const url =
		convexUrl ??
		PUBLIC_CONVEX_URL ??
		(() => {
			throw new Error(
				'No Convex URL provided. Either pass convexUrl parameter or set PUBLIC_CONVEX_URL environment variable.'
			);
		})();

	let convexClient = passedConvexClient;
	if (!convexClient) {
		convexClient = setupConvexClient(url, { disabled: false, ...options });
	}
	return { url, convexClient };
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
	// Get initial state from server if available
	const serverState = getServerState?.();
  $inspect(serverState, 'serverState client.svelte.ts');
	const hasServerAuth = serverState?.isAuthenticated === true;

	// Initialize state
	let sessionData: SessionState['data'] | null = $state(null);
	let sessionPending: boolean = $state(true);
	let isConvexAuthenticated: boolean | null = $state(hasServerAuth ? true : null);
	// Track whether client has received any data from the session subscription
	let hasReceivedClientData = $state(false);
	// Track whether we've ever had a definitive (non-pending) answer from the client
	let hasEverSettled = $state(false);

	authClient.useSession().subscribe((session) => {
		hasReceivedClientData = true;
		const wasAuthenticated = sessionData !== null;
		sessionData = session.data;
		sessionPending = session.isPending;

		// Track when we first get a definitive answer
		if (!session.isPending) {
			hasEverSettled = true;
		}

		// If session state changed from authenticated to unauthenticated, reset Convex auth
		const isNowAuthenticated = sessionData !== null;
		if (wasAuthenticated && !isNowAuthenticated) {
			isConvexAuthenticated = false;
		}
		// If we went back to loading state, reset Convex auth to null
		// But only after we've settled once (not during initial hydration with server auth)
		if (session.isPending && isConvexAuthenticated !== null && hasEverSettled) {
			isConvexAuthenticated = null;
		}
	});

	const isAuthProviderAuthenticated = $derived(sessionData !== null);

	// Client takes over once we've received a definitive answer (not pending)
	// This ensures server state is used during the initial pending phase
	const clientHasTakenOver = $derived(hasReceivedClientData && !sessionPending);

	const isAuthenticated = $derived(
		clientHasTakenOver
			? isAuthProviderAuthenticated && (isConvexAuthenticated ?? false)
			: hasServerAuth // Trust server state during initial hydration
	);

	// Loading state:
	// - Before client data: loading unless we have server auth state
	// - After client data: loading if session pending OR waiting for Convex confirmation
	const isLoading = $derived(
		clientHasTakenOver
			? sessionPending || (isAuthProviderAuthenticated && isConvexAuthenticated === null)
			: !hasServerAuth // Loading if no server state, not loading if server says authenticated
	);

	const { convexClient } = resolveConvexClient(convexUrl, passedConvexClient, options);

	const logVerbose = (message: string) => {
		if (options?.verbose) {
			console.debug(`${new Date().toISOString()} ${message}`);
		}
	};

	const fetchAccessToken = makeFetchAccessTokenBrowser(authClient, logVerbose);

	// Call the one-time token handler
	onMount(() => {
		handleOneTimeToken(authClient);
	});

	// Effect to handle Convex backend confirmation
	// Set auth when:
	// 1. We have server auth (to immediately set up Convex auth on hydration)
	// 2. OR when Better Auth session is available
	$effect(() => {
		let effectRelevant = true;

		// Set auth if we have server auth OR Better Auth session
		const shouldSetAuth = hasServerAuth || isAuthProviderAuthenticated;

		if (shouldSetAuth) {
			// Set auth with callback to receive backend confirmation
			convexClient.setAuth(fetchAccessToken, (backendReportsIsAuthenticated: boolean) => {
				if (effectRelevant) {
					isConvexAuthenticated = backendReportsIsAuthenticated;
				}
			});

			// Cleanup function
			return () => {
				effectRelevant = false;
				// If unmounting or something changed before we finished fetching the token
				// we shouldn't transition to a loaded state.
				isConvexAuthenticated = isConvexAuthenticated ? false : null;
			};
		} else {
			// Clear auth when not authenticated
			convexClient.client.clearAuth();
			return () => {
				isConvexAuthenticated = null;
			};
		}
	});

	// Set context to make auth state available to useAuth
	setContext<AuthContext>(AUTH_CONTEXT_KEY, {
		authClient,
		fetchAccessToken,
		get isLoading() {
			return isLoading;
		},
		get isAuthenticated() {
			return isAuthenticated;
		}
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
	let isConvexAuthenticated: boolean | null = $state(null);
	const isAuthenticated = $derived(isConvexAuthenticated ?? false);
	const isLoading = $derived(isConvexAuthenticated === null);

	const { convexClient } = resolveConvexClient(convexUrl, passedConvexClient, options);

	const logVerbose = (message: string) => {
		if (options?.verbose) {
			console.debug(`${new Date().toISOString()} ${message}`);
		}
	};

	const fetchAccessToken = makeFetchAccessTokenExternal(authClient, externalSession, logVerbose);

	$effect(() => {
		let effectRelevant = true;

		convexClient.setAuth(
			// Convex still calls this as fetchAccessToken({ forceRefreshToken })
			// so we keep the signature and ignore the parameter here.
			(options) => fetchAccessToken(options),
			(backendReportsIsAuthenticated: boolean) => {
				if (effectRelevant) {
					isConvexAuthenticated = backendReportsIsAuthenticated;
				}
			}
		);

		return () => {
			effectRelevant = false;
			isConvexAuthenticated = isConvexAuthenticated ? false : null;
		};
	});

	setContext<AuthContext>(AUTH_CONTEXT_KEY, {
		authClient,
		fetchAccessToken,
		get isLoading() {
			return isLoading;
		},
		get isAuthenticated() {
			return isAuthenticated;
		}
	});
}

/* -------------------------------------------------------------------------- */
/*                     Top-level fetchAccessToken helpers                      */
/* -------------------------------------------------------------------------- */

const makeFetchAccessTokenBrowser = (
	authClient: AuthClient,
	logVerbose: (message: string) => void
): FetchAccessToken => {
	return async ({ forceRefreshToken }) => {
		if (!forceRefreshToken) return null;

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
/*                          Convex client helper                              */
/* -------------------------------------------------------------------------- */

const setupConvexClient = (convexUrl: string, options?: ConvexClientOptions) => {
	// Client resolution priority:
	// 1. Client from context
	// 2. Try to create one if setupConvex is available

	let client: ConvexClient | null = null;

	// Try to get client from context
	try {
		client = getContext('$$_convexClient');
	} catch {
		// Context not available or no client in context
	}

	// If no client and convexUrl is provided, try to create one using setupConvex
	if (!client) {
		try {
			setupConvex(convexUrl, options);
			// Try to get the client from context again after setup
			try {
				client = getContext('$$_convexClient');
			} catch {
				// Context still not available - setupConvex may not have set context properly
				console.warn('setupConvex completed but client not available in context');
			}
		} catch (e) {
			console.warn('Failed to setup Convex client:', e);
		}
	}

	// If we still don't have a client, throw an error
	if (!client) {
		throw new Error(
			'No ConvexClient was provided. Either pass one to createSvelteAuthClient or call setupConvex() first.'
		);
	}

	return client;
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
				throw e;
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

/**
 * Hook to access authentication state and functions
 * Must be used within a component that has createSvelteAuthClient called in its parent tree
 */
export const useAuth = (): {
	isLoading: boolean;
	isAuthenticated: boolean;
	fetchAccessToken: FetchAccessToken;
} => {
	const authContext = getContext<AuthContext>(AUTH_CONTEXT_KEY);

	if (!authContext) {
		throw new Error(
			'useAuth must be used within a component that has createSvelteAuthClient called in its parent tree'
		);
	}

	return {
		get isLoading() {
			return authContext.isLoading;
		},
		get isAuthenticated() {
			return authContext.isAuthenticated;
		},
		fetchAccessToken: authContext.fetchAccessToken
	};
};
