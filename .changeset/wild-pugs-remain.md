---
'@mmailaender/convex-better-auth-svelte': minor
---

Retry transient query failures in the SvelteKit `createConvexHttpClient` and forward a custom `fetch`, so an SSR load survives a proxy answering 502 for a second during a deploy. Only `/api/query`, `/api/query_ts` and `/api/query_at_ts` are repeated; a query whose function threw (Convex status 560) is returned at once, and mutations and actions are never retried, because a lost response does not prove the write did not commit, and `retryTransientQueries: false` opts out.
