import type { PageServerLoad } from './$types.ts';
import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient } from '@mmailaender/convex-better-auth-svelte/sveltekit';

export const load: PageServerLoad = async ({ cookies }) => {
	const client = createConvexHttpClient({ cookies });

	try {
		const currentUser = await client.query(api.auth.getCurrentUser, {});
		return { currentUser };
	} catch {
		return { currentUser: null };
	}
};
