import type { Handle } from '@sveltejs/kit';
import { getToken } from '$lib/sveltekit/index.js';
import { withServerConvexToken } from '@mmailaender/convex-svelte/sveltekit/server';

export const handle: Handle = async ({ event, resolve }) => {
	const token = getToken(event.cookies);
	event.locals.token = token;
	return withServerConvexToken(token, () => resolve(event));
};
