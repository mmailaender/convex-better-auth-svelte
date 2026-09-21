---
'@mmailaender/convex-better-auth-svelte': patch
---

Release the Better Auth session subscriptions that `createSvelteAuthClient` adds when its component is destroyed. With a module-scoped auth client, every server render used to leave a `$sessionSignal` and a `session` listener on the client, together with the per-render state they capture, for the lifetime of the server process.
