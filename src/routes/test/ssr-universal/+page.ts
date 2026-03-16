/**
 * Universal load function — runs on BOTH server (SSR) and client (navigation).
 *
 * Uses convexLoad WITHOUT explicit { token } option.
 * The token is automatically provided by withServerConvexToken in hooks.server.ts
 * during SSR, and by the authenticated singleton ConvexClient during client-side
 * navigation.
 */
import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api.js';

export const load = async () => {
	let currentUser = null;
	try {
		currentUser = await convexLoad(api.auth.getCurrentUser, {});
	} catch {
		// Not authenticated — currentUser stays null
	}

	return { currentUser };
};
