import {
	initConvex,
	encodeConvexLoad,
	decodeConvexLoad
} from '@mmailaender/convex-svelte/sveltekit';
import { PUBLIC_CONVEX_URL } from '$env/static/public';

// Initialize the Convex singleton on both server and client.
// This ensures getConvexUrl() is available during SSR load functions
// and that transport.decode can create live subscriptions.
initConvex(PUBLIC_CONVEX_URL);

export const transport = {
	ConvexLoadResult: {
		encode: encodeConvexLoad,
		decode: decodeConvexLoad
	}
};
