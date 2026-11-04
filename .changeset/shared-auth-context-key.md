---
'@mmailaender/convex-better-auth-svelte': patch
---

`useAuth()` no longer throws "must be used within a component that has createSvelteAuthClient called in its parent tree" when Vite's dev server evaluates the adapter a second time during a request. The Better Auth context key is now a registered symbol, so both evaluations share it.
