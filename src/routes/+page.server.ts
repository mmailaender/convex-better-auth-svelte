import type { PageServerLoad } from './$types.ts';
import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient } from '$lib/sveltekit/index.js';

export const load: PageServerLoad = async ({ locals }) => {
	const client = createConvexHttpClient({ token: locals.token });

	try {
		const currentUser = await client.query(api.auth.getCurrentUser, {});

		return { currentUser };
	} catch {
		return { currentUser: null };
	}
};
