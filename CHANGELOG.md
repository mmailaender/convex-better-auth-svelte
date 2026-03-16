# Changelog

## 0.7.0

### Minor Changes

- feat: `getAuthState()` auto-reads token from `withServerConvexToken` context

  When `withServerConvexToken` is set up in `hooks.server.ts`, `getAuthState()` can now be called **with no arguments** — the token is read automatically from `AsyncLocalStorage`. This eliminates the redundant `getToken()` call and removes the need to pass `createAuth` and `cookies`:

  ```ts
  // Before (still supported)
  const authState = await getAuthState(createAuth, cookies);

  // After (recommended)
  const authState = getAuthState(); // synchronous, no await needed
  ```

  The old signature `getAuthState(createAuth, cookies)` is preserved for backward compatibility.

- feat: `createConvexHttpClient()` auto-reads token from `withServerConvexToken` context

  The `args` parameter is now optional. When no explicit `token` is provided, the client reads from `AsyncLocalStorage`:

  ```ts
  // Before
  const client = createConvexHttpClient({ token: locals.token });

  // After (recommended)
  const client = createConvexHttpClient();
  ```

## 0.6.2

### Patch Changes

- fix: resolve auth cookie behind reverse proxy when cookie name prefix differs (`__Secure-` vs non-secure)
  - `getToken` now returns the alternative cookie variant when the primary lookup fails, instead of only logging a warning. This fixes SSR treating users as unauthenticated when the app runs behind a reverse proxy where the external URL (HTTPS) differs from the internal origin.
  - Follows the same fallback pattern used by Better Auth's own `getSessionCookie`.

## 0.6.1

### Patch Changes

- fix: allow token fetch during SSR hydration before session atom settles
  - During initial hydration, `getSessionData()` returns `null` because the Better Auth session atom hasn't loaded yet. The old code skipped the token fetch in this case, causing the Convex client's synchronous `setAuth()` to receive no token — resulting in unauthenticated query subscriptions and a flash of `null` data overriding `initialData`.
  - Track `sessionHasBeenAvailable` flag: only skip token fetches when the session was previously available and is now cleared (sign-out). During hydration, browser cookies are still valid for the token endpoint.

## 0.6.0

### Minor Changes

- feat: migrate to `@mmailaender/convex-svelte`
  - switch peer dependency to `@mmailaender/convex-svelte`
  - refactor to use primitives now provided by the extended Convex Svelte client
  - move shared primitives out of this package into `@mmailaender/convex-svelte`
  - keep `convex-better-auth-svelte` focused on Better Auth integration

- chore: internal architecture cleanup

## 0.5.3

### Patch Changes

- fix: prevent SSR auth flash after sign-in client navigation by keeping client takeover latched after first settled session state.

## 0.5.2

### Patch Changes

- Fix: client auth state to properly handle sign-out after SSR hydration

## 0.5.1

### Patch Changes

- fix: Sets the host header on the proxied request to match the target Convex URL instead of copying the original request's host => Prevents request loops when both the frontend and Convex are behind the same reverse proxy (e.g. Traefik)

## 0.5.0

### Minor Changes

- feat: update to convex better auth 0.10 and better auth 1.4

## 0.4.2

### Patch Changes

- fix: initialize correctly auth.isLoading with false if the client receives the server state during ssr.

## 0.4.1

### Patch Changes

- chore: remove debug inspect statement

## 0.4.0

### Minor Changes

- Add SSR initialization for auth client

## 0.3.0

### Minor Changes

- feat: add external session support for device authorization and api keys

## 0.2.1

### Patch Changes

- chore: update convex-svelte minimum version to 0.0.12
  This avoids effect in teardown errors by using the new "skip" query option for queries that depend on isAuthenticated.

## 0.2.0

### Minor Changes

- Rised @convex-dev/better-auth peer dependency to 0.9.0
- Rised better-auth peer dependency to 1.3.27

## 0.1.1

### Patch Changes

- fix: remove bloated logging for createAuth in getToken
- Updated dependencies
  - @mmailaender/convex-better-auth-svelte@0.1.1

## 0.1.0

### Minor Changes

- fix: refactor createConvexHttpClient from cookie to token - fixes https://github.com/mmailaender/convex-better-auth-svelte/issues/6

## 0.0.6

### Patch Changes

- Updated docs to support convex better auth 0.8
- Updated peer-dependencies
  - @convex-dev/better-auth@0.8.6

## 0.0.5

### Patch Changes

- d10b08c: Update better-auth and convex dependencies to peer deps

## 0.0.4

- Feature: Validate isAuthenticated via setAuth callback instead via api similar like react. Removes the need to pass the api to createSvelteAuthClient().

```ts
import { createSvelteAuthClient } from '$lib/svelte/index.js';
import { authClient } from '$lib/auth-client.js';

createSvelteAuthClient({ authClient });
```

## 0.0.3

- Fix: Pass convex api to createSvelteAuthClient() to resolve type errors

```ts
import { createSvelteAuthClient } from '$lib/svelte/index.js';
import { authClient } from '$lib/auth-client.js';
import { api } from '$convex/_generated/api.js';

createSvelteAuthClient({ authClient, api });
```

## 0.0.2

- Add createConvexHttpClient() for sveltekit to simplify creating a Convex client with the correct authentication token

## 0.0.1

- Initial release
