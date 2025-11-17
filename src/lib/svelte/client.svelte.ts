import { getContext, setContext, onMount } from 'svelte';

import { PUBLIC_CONVEX_URL } from '$env/static/public';

import { setupConvex } from 'convex-svelte';

import type { ConvexClient, ConvexClientOptions } from 'convex/browser';
import isNetworkError from 'is-network-error';
import type { BetterAuthClientPlugin, ClientOptions } from 'better-auth';
import type { createAuthClient } from 'better-auth/svelte';
import type { crossDomainClient, convexClient } from '@convex-dev/better-auth/client/plugins';

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
			ClientOptions & {
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

// Context key for sharing auth client and functions
const AUTH_CONTEXT_KEY = Symbol('auth-context');

type AuthContext = {
	authClient: AuthClient;
	fetchAccessToken: (options: { forceRefreshToken: boolean }) => Promise<string | null>;
	isLoading: boolean;
	isAuthenticated: boolean;
};

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
 *
 * You can combine both flows in the same app, but typically you either:
 * - rely purely on `useSession()` (browser), or
 * - rely purely on `externalSession` (headless/device/API key).
 */
export function createSvelteAuthClient({
	authClient,
	convexUrl,
	convexClient,
	options,
	externalSession
}: {
	authClient: AuthClient;
	convexUrl?: string;
	convexClient?: ConvexClient;
	options?: ConvexClientOptions;
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
	 * to the Better Auth Convex plugin's `/convex/token` endpoint. If you return
	 * `null`, the user is treated as unauthenticated from the auth-provider
	 * perspective.
	 */
	externalSession?: {
		getAccessToken: () => string | null | Promise<string | null>;
	};
}) {
	let sessionData: SessionState['data'] | null = $state(null);
	let sessionPending: boolean = $state(true);

	let hasExternalCredential: boolean = $state(false);

	let isConvexAuthenticated: boolean | null = $state(null);

	if (!externalSession) {
		authClient.useSession().subscribe((session) => {
			const wasAuthenticated = sessionData !== null;
			sessionData = session.data;
			sessionPending = session.isPending;

			// If session state changed from authenticated to unauthenticated, reset Convex auth
			const isNowAuthenticated = sessionData !== null;
			if (wasAuthenticated && !isNowAuthenticated) {
				isConvexAuthenticated = false;
			}
			// If we went back to loading state, reset Convex auth to null
			if (session.isPending && isConvexAuthenticated !== null) {
				isConvexAuthenticated = null;
			}
		});
	} else {
		// In external-only mode, we don't have a Better Auth session store,
		// so there is no pending state on that side.
		sessionPending = false;
	}

	const isAuthProviderAuthenticated = $derived(
		externalSession ? hasExternalCredential : sessionData !== null
	);

	const isAuthenticated = $derived(isAuthProviderAuthenticated && (isConvexAuthenticated ?? false));

	// Loading state - we're loading if session is pending OR if we have a session but no Convex confirmation yet
	const isLoading = $derived(
		sessionPending || (isAuthProviderAuthenticated && isConvexAuthenticated === null)
	);

	const fetchAccessToken = async ({
		forceRefreshToken
	}: {
		forceRefreshToken: boolean;
	}): Promise<string | null> => {
		// In external session mode, always try to fetch a Convex JWT.
		if (externalSession) {
			const token = await fetchToken();
			logVerbose(`external: returning ${token ? 'token' : 'null'}`);
			return token;
		}
		// Browser / cookie mode: only fetch on explicit refresh requests
		if (forceRefreshToken) {
			const token = await fetchToken();
			logVerbose(`returning retrieved token`);
			return token;
		}
		return null;
	};

	const url =
		convexUrl ??
		PUBLIC_CONVEX_URL ??
		(() => {
			throw new Error(
				'No Convex URL provided. Either pass convexUrl parameter or set PUBLIC_CONVEX_URL environment variable.'
			);
		})();
	// Initialize the Convex client if not provided
	if (!convexClient) {
		convexClient = setupConvexClient(url, { disabled: false, ...options });
	}

	const logVerbose = (message: string) => {
		if (options?.verbose) {
			console.debug(`${new Date().toISOString()} ${message}`);
		}
	};

	const fetchToken = async (): Promise<string | null> => {
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
				if (externalSession) {
					const rawToken = await externalSession.getAccessToken();

					if (!rawToken) {
						logVerbose(`no external access token available`);
						hasExternalCredential = false;
						return null;
					}

					hasExternalCredential = true;

					const { data } = await authClient.convex.token(undefined, {
						headers: {
							Authorization: `Bearer ${rawToken}`
						}
					});

					return data?.token ?? null;
				}

				// Browser / cookie-based session
				const { data } = await authClient.convex.token();
				return data?.token ?? null;
			} catch (e) {
				if (!isNetworkError(e)) {
					// For external mode, a non-network error (e.g. 401) means our
					// credential is invalid; mark it as gone.
					if (externalSession) {
						hasExternalCredential = false;
					}
					throw e;
				}
				if (retries > 10) {
					logVerbose(`fetchToken failed with network error, giving up`);
					throw e;
				}
				const backoff = nextBackoff();
				logVerbose(`fetchToken failed with network error, attempting retry in ${backoff}ms`);
				await new Promise((resolve) => setTimeout(resolve, backoff));
				return fetchWithRetry();
			}
		};

		return fetchWithRetry();
	};

	// TODO: This needs to be eventually an reactive effect if someone adds an OTT to the URL programatically.
	// Call the one-time token handler
	onMount(() => {
		handleOneTimeToken(authClient);
	});

	// Updated effect to handle backend confirmation
	$effect(() => {
		let effectRelevant = true;

		if (externalSession) {
			// External flow: always setAuth; fetchAccessToken will return a Convex JWT or null
			convexClient.setAuth(fetchAccessToken, (backendReportsIsAuthenticated: boolean) => {
				if (effectRelevant) isConvexAuthenticated = backendReportsIsAuthenticated;
			});
			return () => {
				effectRelevant = false;
				isConvexAuthenticated = isConvexAuthenticated ? false : null;
			};
		}

		// Browser / cookie-based session flow: keep the session gate
		if (sessionData !== null) {
			convexClient.setAuth(fetchAccessToken, (backendReportsIsAuthenticated: boolean) => {
				if (effectRelevant) isConvexAuthenticated = backendReportsIsAuthenticated;
			});
			return () => {
				effectRelevant = false;
				isConvexAuthenticated = isConvexAuthenticated ? false : null;
			};
		} else {
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
			'No ConvexClient was provided. Either pass one to setupConvexAuth or call setupConvex() first.'
		);
	}

	return client;
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

/**
 * Hook to access authentication state and functions
 * Must be used within a component that has createSvelteAuthClient called in its parent tree
 */
export const useAuth = (): {
	isLoading: boolean;
	isAuthenticated: boolean;
	fetchAccessToken: ({
		forceRefreshToken
	}: {
		forceRefreshToken: boolean;
	}) => Promise<string | null>;
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
