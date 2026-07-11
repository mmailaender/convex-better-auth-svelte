---
'@mmailaender/convex-better-auth-svelte': patch
---

Fix `AuthClient` type incompatibility with better-auth 1.6.23. The type is now a minimal structural interface of the members the integration actually uses instead of being derived from `ReturnType<typeof createAuthClient<...>>`, whose inference collapsed the session type to `never` on better-auth 1.6.23 and rejected every concrete auth client. Backwards compatible with older better-auth versions (verified against 1.6.15).
