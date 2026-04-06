import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient, getAuthState } from '$lib/sveltekit/index.js';
import type { LayoutServerLoad } from './$types.js';

export const load = (async ({ locals }) => {
	const client = createConvexHttpClient({ token: locals.token });

	const authState = getAuthState();

	console.log('authState', authState);
	try {
		const currentUser = await client.query(api.auth.getCurrentUser, {});

		return { currentUser, authState };
	} catch {
		return { currentUser: null, authState };
	}
}) satisfies LayoutServerLoad;
