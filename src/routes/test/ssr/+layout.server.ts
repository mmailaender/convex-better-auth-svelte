import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient, getAuthState } from '$lib/sveltekit/index.js';
import type { LayoutServerLoad } from './$types.js';

export const load = (async () => {
	const client = createConvexHttpClient();
	const authState = getAuthState();

	try {
		const currentUser = await client.query(api.auth.getCurrentUser, {});
		return { currentUser, authState };
	} catch {
		return { currentUser: null, authState };
	}
}) satisfies LayoutServerLoad;
