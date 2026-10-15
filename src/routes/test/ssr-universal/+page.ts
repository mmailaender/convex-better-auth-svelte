/**
 * Universal load function — runs on BOTH server (SSR) and client (navigation).
 *
 * Uses convexLoad WITHOUT explicit { token } option.
 * The token is automatically provided by withServerConvexToken in hooks.server.ts
 * during SSR, and by the authenticated singleton ConvexClient during client-side
 * navigation. Passing the load's fetch lets the browser reuse the server's result
 * during hydration (convexLoadHydration in hooks.server.ts), before auth is set up.
 */
import { convexLoad } from 'convex-svelte/sveltekit';
import { api } from '#convex/_generated/api.js';

export const load = async ({ fetch }) => {
	let currentUser = null;
	try {
		currentUser = await convexLoad(api.auth.getCurrentUser, {}, { fetch });
	} catch {
		// Not authenticated — currentUser stays null
	}

	return { currentUser };
};
