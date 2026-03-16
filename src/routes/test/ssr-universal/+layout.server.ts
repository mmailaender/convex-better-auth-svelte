import { getAuthState } from '$lib/sveltekit/index.js';
import type { LayoutServerLoad } from './$types.js';

export const load = (() => ({
	authState: getAuthState()
})) satisfies LayoutServerLoad;
