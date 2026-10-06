---
'@mmailaender/convex-better-auth-svelte': minor
---

Support SvelteKit 3 (and keep supporting SvelteKit 2). Fixes #47.

The package no longer imports `$env/static/public`, which SvelteKit 3 deprecates and which fails the build there unless the app declares the variables in `src/env.ts`. The Convex URLs are now resolved like this:

- `createSvelteAuthClient` and `createConvexHttpClient`: an explicit `convexUrl`, otherwise the URL registered with `initConvex()` from `convex-svelte/sveltekit`.
- `createSvelteKitHandler`: an explicit `convexSiteUrl`, otherwise the `*.convex.site` URL derived from the `*.convex.cloud` URL registered with `initConvex()`.

**Breaking:** `PUBLIC_CONVEX_URL` and `PUBLIC_CONVEX_SITE_URL` are no longer read implicitly. If you relied on that, either call `initConvex(PUBLIC_CONVEX_URL)` in `src/hooks.ts` (as the SSR setup in the SvelteKit guide already does), or pass the URLs explicitly:

```ts
// src/routes/api/auth/[...all]/+server.ts
import { PUBLIC_CONVEX_SITE_URL } from '$app/env/public'; // SvelteKit 2: '$env/static/public'
export const { GET, POST } = createSvelteKitHandler({ convexSiteUrl: PUBLIC_CONVEX_SITE_URL });
```

Local (`convex dev --local`), self-hosted and custom-domain deployments always need `convexSiteUrl`, because their site URL can't be derived.

`@sveltejs/kit` is now a declared peer dependency (`^2.0.0 || ^3.0.0`).
