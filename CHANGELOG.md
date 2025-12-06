# Changelog

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
