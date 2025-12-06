import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient } from '$lib/sveltekit/index.js';
import type { PageServerLoad } from './$types.js';

export const load = (async ({ locals }) => {
	const client = createConvexHttpClient({ token: locals.token });

	// Fetch both public and protected data on server
	const publicData = await client.query(api.auth.getPublicData, {});

	let protectedData = null;
	try {
		protectedData = await client.query(api.auth.getCurrentUser, {});
	} catch {
		// Not authenticated
	}

	return {
		publicData,
		protectedData
	};
}) satisfies PageServerLoad;
