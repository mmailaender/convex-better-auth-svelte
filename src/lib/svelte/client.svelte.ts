import { getContext, setContext, onMount } from 'svelte';

import { PUBLIC_CONVEX_URL } from '$env/static/public';

import { setupConvex, useQuery } from 'convex-svelte';
import { api } from '$convex/_generated/api.js';

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
};

/**
 * Create a Convex Better Auth client for Svelte
 */
export function createSvelteAuthClient({
	authClient,
	convexUrl,
	convexClient,
	options
}: {
	authClient: AuthClient;
	convexUrl?: string;
	convexClient?: ConvexClient;
	options?: ConvexClientOptions;
}) {
	let sessionData: SessionState['data'] | null = $state(null);
	authClient.useSession().subscribe((session) => {
		console.log(session);
		sessionData = session.data;
	});
	const isAuthenticated = $derived(sessionData !== null);

	const fetchAccessToken = async ({
		forceRefreshToken
	}: {
		forceRefreshToken: boolean;
	}): Promise<string | null> => {
		if (forceRefreshToken) {
			const token = await fetchToken(authClient, logVerbose);
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

	// TODO: This needs to be eventually an reactive effect if someone adds an OTT to the URL programatically.
	// Call the one-time token handler
	onMount(() => {
		handleOneTimeToken(authClient);
	});

	$effect(() => {
		if (isAuthenticated) {
			convexClient.setAuth(fetchAccessToken);
		} else {
			convexClient.client.clearAuth();
		}
	});

	// Set context to make authClient and fetchAccessToken available to useAuth
	setContext<AuthContext>(AUTH_CONTEXT_KEY, {
		authClient,
		fetchAccessToken
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

const fetchToken = async (
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

	const isAuthenticatedResponse = useQuery(api.auth.isAuthenticated, {});
	const isLoading = $derived(isAuthenticatedResponse.isLoading ? true : false);
	const isAuthenticated = $derived(isAuthenticatedResponse.data ? true : false);

	return {
		get isLoading() {
			return isLoading;
		},
		get isAuthenticated() {
			return isAuthenticated;
		},
		fetchAccessToken: authContext.fetchAccessToken
	};
};
