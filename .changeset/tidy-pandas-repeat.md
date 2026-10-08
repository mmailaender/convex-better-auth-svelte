---
'@mmailaender/convex-better-auth-svelte': patch
---

Support custom Convex JWT cookie names in the cookie-only `getToken(cookies, cookieGetter)` overload. Pass a cookie getter (e.g. built with better-auth's `createCookieGetter`) to resolve non-default cookie names — such as custom `advanced.cookiePrefix` setups or full name overrides — during SvelteKit SSR without instantiating `createAuth()`. Also replaces hardcoded `"__Secure-"` literals with better-auth's `SECURE_COOKIE_PREFIX`.
