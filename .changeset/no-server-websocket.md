---
'@mmailaender/convex-better-auth-svelte': patch
---

`createSvelteAuthClient` no longer forces the Convex client on. In apps without `initConvex()` it used to pass `disabled: false` to `setupConvex`, so the client it created during server rendering opened a WebSocket on the server that stayed open as long as the process. convex-svelte now decides on its own: disabled on the server, enabled in the browser.
