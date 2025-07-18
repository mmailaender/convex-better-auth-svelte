import { getContext } from 'svelte';

import { PUBLIC_CONVEX_URL } from '$env/static/public';

import { setupConvex, useQuery } from 'convex-svelte';
import { api } from '$convex/_generated/api';

import type { ConvexClient, ConvexClientOptions } from 'convex/browser';

// Auth state store

// const isLoading = $derived(isAuthenticatedResponse.isLoading ? true : false);
// const isAuthenticated = $derived(isAuthenticatedResponse.data ? true : false);

/**
 * Create a Convex Better Auth client for Svelte
 */
export function createSvelteAuthClient({
	client,
	convexUrl,
	options
}: {
	client?: ConvexClient;
	convexUrl?: string;
	options?: ConvexClientOptions;
}) {
	const url =
		convexUrl ??
		PUBLIC_CONVEX_URL ??
		(() => {
			throw new Error(
				'No Convex URL provided. Either pass convexUrl parameter or set PUBLIC_CONVEX_URL environment variable.'
			);
		})();
	// Initialize the Convex client if not provided
	if (!client) {
		client = setupConvexClient(url, { disabled: false, ...options });
	}
}

const setupConvexClient = (convexUrl: string, options?: ConvexClientOptions) => {
	// Client resolution priority:
	// 1. Client from context
	// 2. Try to create one if setupConvex is available

	let client: ConvexClient | null = null;

	// Try to get client from context
	try {
		client = getContext('$$_convexClient');
	} catch (e) {
		// Context not available or no client in context
	}

	// If no client and convexUrl is provided, try to create one using setupConvex
	if (!client) {
		try {
			setupConvex(convexUrl, options);
			// After setting up, try to get the client from context
			try {
				client = getContext('$$_convexClient');
			} catch (e) {
				// Context not available after setup
			}
		} catch (e) {
			console.warn('Failed to create Convex client:', e);
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

export const useAuth = () => {
    const isAuthenticatedResponse = useQuery(api.auth.isAuthenticated, {});
	const isLoading = $derived(isAuthenticatedResponse.isLoading ? true : false);
	const isAuthenticated = $derived(isAuthenticatedResponse.data ? true : false);
	
	return {
        get isLoading() {
            return isLoading;
        },
        get isAuthenticated() {
            return isAuthenticated;
        }
	};
}
