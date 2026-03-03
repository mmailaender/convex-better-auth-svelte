import { createAuth } from '$convex/auth.js';
import { getAuthState } from '$lib/sveltekit/index.js';
import type { LayoutServerLoad } from './$types.js';

export const load = (async ({ cookies }) => {
	const authState = await getAuthState(createAuth, cookies);
	return { authState };
}) satisfies LayoutServerLoad;
