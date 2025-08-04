# Changelog

## 0.0.3

- Fix: Pass convex api to createSvelteAuthClient() to resolve type errors
```ts
import { createSvelteAuthClient } from '$lib/svelte/index.js';
import { authClient } from '$lib/auth-client.js';
import { api } from '$convex/_generated/api.js';

createSvelteAuthClient({ authClient, api })
```


## 0.0.2

- Add createConvexHttpClient() for sveltekit to simplify creating a Convex client with the correct authentication token

## 0.0.1

- Initial release
