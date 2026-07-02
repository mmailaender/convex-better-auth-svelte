---
'@mmailaender/convex-better-auth-svelte': patch
---

Retry transient HTTP errors (5xx, 408, 429) when fetching the Convex token instead of treating them as a sign-out. The Better Auth client resolves with `{ data, error }` on HTTP error statuses rather than throwing, so a single 502 while the server restarts during a deploy used to be reported as "no token" and flipped `useAuth().isAuthenticated` to false with no recovery until a full reload. Only definitive 4xx responses (401/403) are now treated as an expired or revoked session.
