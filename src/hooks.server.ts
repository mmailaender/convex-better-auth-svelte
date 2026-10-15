import type { Handle } from '@sveltejs/kit/hooks';
import { sequence } from '@sveltejs/kit/hooks';
import { getToken } from '#lib/sveltekit/index.js';
import { withServerConvexToken } from 'convex-svelte/sveltekit/server';
import { convexLoadHydration } from 'convex-svelte/sveltekit/server/hydration';

const convexAuth: Handle = async ({ event, resolve }) => {
	const token = getToken(event.cookies);
	event.locals.token = token;
	return withServerConvexToken(token, () => resolve(event));
};

// After convexAuth, so convexLoad queries in universal loads run with the user's token.
export const handle = sequence(convexAuth, convexLoadHydration);
