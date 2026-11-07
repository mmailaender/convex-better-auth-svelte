---
'@mmailaender/convex-better-auth-svelte': minor
---

`createSvelteKitHandler` forwards the browser's `accept-language` to Convex, so Better Auth callbacks such as emails can follow the visitor's language. A new `forwardHeaders(event)` option adds headers computed from the request event to every forwarded request, for example the visitor's address from `event.getClientAddress()` for Better Auth's rate limits (`advanced.ipAddress.ipAddressHeaders`). The handler still drops `x-forwarded-for` and `cf-connecting-ip` from the incoming request. Because Convex's `.site` URL is public, trust a header added this way only when the request also proves it came through your app, for example with a shared secret your Convex route checks.
