---
'@mmailaender/convex-better-auth-svelte': patch
---

`getToken(cookies)` now finds the Convex JWT cookie when Better Auth uses a custom `advanced.cookiePrefix`. Pass the prefix as an option, like the `cookiePrefix` option of `@convex-dev/better-auth`'s `getToken`:

```ts
// src/hooks.server.ts
const token = getToken(event.cookies, { cookiePrefix: 'myapp' });
```

Without it, SSR treated every user as signed out on apps with a custom prefix. The cookie lookup now follows Better Auth's `getSessionCookie()`, which also accepts a `-` separator (`better-auth-convex_jwt`).
