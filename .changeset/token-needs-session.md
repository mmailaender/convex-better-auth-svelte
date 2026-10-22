---
'@mmailaender/convex-better-auth-svelte': minor
---

`getToken(cookies)` returns the Convex token only while Better Auth's session cookie is present, so a request without one renders signed out. Before, the JWT cookie alone was enough. A `/convex/token` answer that left the server before a sign-out and reached the browser after it set that cookie again. The page the sign-out reloads then rendered as the ended session until the JWT expired, 15 minutes by default. `getAuthState()` and `withServerConvexToken(getToken(event.cookies), …)` follow. Both overloads change: `getToken(cookies)` and the deprecated `getToken(createAuth, cookies)`. Two cases need the new `sessionCookie` option. If your auth config renames the session cookie (`advanced.cookies.session_token.name`), pass its full name. If the app authenticates without a session cookie, as an `externalSession` does, pass `sessionCookie: false`; then the JWT cookie alone counts, as before.
