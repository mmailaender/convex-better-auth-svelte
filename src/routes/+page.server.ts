import type { PageServerLoad } from './$types.ts';
import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient } from '$lib/sveltekit/index.js';

export const load: PageServerLoad = async ({ cookies }) => {
	const client = createConvexHttpClient({ cookies });
	const currentUser = await client.query(api.auth.getCurrentUser, {});

	return { currentUser };
};