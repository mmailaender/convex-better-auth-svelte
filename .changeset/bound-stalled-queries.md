---
'@mmailaender/convex-better-auth-svelte': minor
---

Fail a stalled query in the SvelteKit `createConvexHttpClient` after 10 seconds, so a connection that hangs before its headers or halfway through the body cannot hold an SSR load open until the runtime gives up (300 seconds on Node). The deadline covers each query attempt through the last body byte, a timed-out query is not retried, and mutations and actions have no deadline. Set `queryTimeoutMs` to change it or `false` to opt out.
