import type { Handle } from '@sveltejs/kit';
import { createAuth } from '$convex/auth.js';
import { getToken } from '$lib/sveltekit/index.js';
import { withServerConvexToken } from '@mmailaender/convex-svelte/sveltekit/server';

export const handle: Handle = async ({ event, resolve }) => {
	const token = await getToken(createAuth, event.cookies);
	event.locals.token = token;
	return withServerConvexToken(token, () => resolve(event));
};
