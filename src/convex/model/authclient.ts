import { createAuthClient } from 'better-auth/svelte';
import { convexClient } from '@convex-dev/better-auth/client/plugins';

export const authClient = createAuthClient({
	baseURL: process.env.CONVEX_SITE_URL,
	plugins: [convexClient()]
});
