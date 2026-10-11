import { getConvexUrl } from 'convex-svelte/sveltekit';

const CONVEX_CLOUD_SUFFIX = '.convex.cloud';
const CONVEX_SITE_SUFFIX = '.convex.site';

/**
 * Resolve the Convex deployment URL: the explicit `convexUrl` if given,
 * otherwise the URL registered with convex-svelte's `initConvex()`.
 *
 * The package deliberately reads no environment variables, so it works with
 * both SvelteKit 2 (`$env/*`) and SvelteKit 3 (`$app/env/*`).
 */
export const resolveConvexUrl = (convexUrl: string | undefined): string => {
	if (convexUrl) return convexUrl;

	try {
		return getConvexUrl();
	} catch {
		throw new Error(
			'Convex URL not set. Pass `convexUrl` explicitly, or call `initConvex(PUBLIC_CONVEX_URL)` ' +
				'from `convex-svelte/sveltekit` in `src/hooks.ts`.'
		);
	}
};

/**
 * Derive the HTTP actions URL (`*.convex.site`) from a Convex Cloud
 * deployment URL (`*.convex.cloud`). Returns `undefined` for local,
 * self-hosted, or custom-domain deployments, where no such mapping exists.
 */
export const deriveConvexSiteUrl = (convexUrl: string): string | undefined => {
	const url = new URL(convexUrl);
	if (!url.hostname.endsWith(CONVEX_CLOUD_SUFFIX)) return undefined;

	url.hostname = url.hostname.slice(0, -CONVEX_CLOUD_SUFFIX.length) + CONVEX_SITE_SUFFIX;
	return url.origin;
};

/**
 * Resolve the Convex HTTP actions URL: the explicit `convexSiteUrl` if given,
 * otherwise derived from the deployment URL registered with `initConvex()`.
 */
export const resolveConvexSiteUrl = (convexSiteUrl: string | undefined): string => {
	if (convexSiteUrl) return convexSiteUrl;

	let convexUrl: string;
	try {
		convexUrl = getConvexUrl();
	} catch {
		throw new Error(
			'Convex site URL not set. Pass `convexSiteUrl` to `createSvelteKitHandler()`, or call ' +
				'`initConvex(PUBLIC_CONVEX_URL)` from `convex-svelte/sveltekit` in `src/hooks.ts` ' +
				'with a Convex Cloud URL.'
		);
	}

	const derived = deriveConvexSiteUrl(convexUrl);
	if (!derived) {
		throw new Error(
			`Cannot derive the Convex site URL from "${convexUrl}" (only *.convex.cloud URLs can be ` +
				'derived). Pass `convexSiteUrl` to `createSvelteKitHandler()`, e.g. ' +
				'`createSvelteKitHandler({ convexSiteUrl: PUBLIC_CONVEX_SITE_URL })`.'
		);
	}
	return derived;
};
