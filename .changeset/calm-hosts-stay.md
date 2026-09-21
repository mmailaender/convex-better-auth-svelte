---
'@mmailaender/convex-better-auth-svelte': patch
---

Stop sending `x-forwarded-host` from `createSvelteKitHandler` to the Convex site. Convex's edge can resolve the deployment from that header, so the app's own host there made every `/api/auth/*` request die as an empty 404. The app host still travels in `x-better-auth-forwarded-host`, which `@convex-dev/better-auth` >= 0.12.0 restores before Better Auth handles the request.
