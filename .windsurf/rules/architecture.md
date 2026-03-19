---
trigger: always_on
---

# Architecture: convex-svelte vs convex-better-auth-svelte

These two packages have a clear layered relationship. **convex-svelte** is the foundation; **convex-better-auth-svelte** is a thin adapter on top.

## convex-svelte (`@mmailaender/convex-svelte`)

**Auth-provider-agnostic** Svelte library for Convex. Owns the entire auth state machine.

- **`setupConvex`** — initializes the `ConvexClient` and sets Svelte context.
- **`setupAuth`** — reactive `$effect` that manages `isConvexAuthenticated` (`true | false | null`) based on a generic auth provider getter `() => { isLoading, isAuthenticated, fetchAccessToken }`.
- **`useAuth`** — reads the auth context (`isLoading`, `isAuthenticated`) set by `setupAuth`.
- **`useQuery` / `usePaginatedQuery`** — reactive Convex query primitives.
- **SSR support** — `initialState` seeding, `providerHasSettled` guard, SvelteKit server helpers (`initConvex`, `convexLoad`, transport encode/decode).
- **State machine rules** (effect branches):
  1. Loading reset when provider goes back to loading after having settled.
  2. Immediate `false` when provider says not-authenticated (`currentConvexAuth !== false`).
  3. `setAuth` + backend confirmation when provider says authenticated.
  4. Cleanup uses `setAuth(async () => null)` instead of `clearAuth()`.
  5. No `isConvexAuthenticated` reset in cleanup (prevents flash on re-run).
- **Getter rules**:
  - `isLoading` = `isConvexAuthenticated === null`, plus stale-detection: if the provider changed but the effect hasn't processed it yet, report loading.
  - `isAuthenticated` trusts `convexAuth === true` (backend confirmed) over transient provider changes.
  - SSR guard trusts `initialState` until provider settles.

**Key principle**: convex-svelte knows nothing about Better Auth, session atoms, or any specific auth provider. It only consumes the generic `ConvexAuthProvider` shape.

## convex-better-auth-svelte

**Better Auth adapter** that bridges Better Auth's session management with convex-svelte's `setupAuth`.

- **`createSvelteAuthClient`** — subscribes to Better Auth's `useSession()` atom and maps it to the `ConvexAuthProvider` shape that `setupAuth` expects. Supports browser flow (cookies) and external session flow (device auth, API keys, CLIs).
- **Transient guard (150ms)** — intercepts the `{ data: null, isPending: false }` state that Better Auth's session atom emits transiently during SvelteKit client-side navigation. Reports `isPending: true` temporarily so that `setupAuth`'s loading reset fires instead of an immediate `false` (which would cause a flash).
- **`authOperationPending` / `isAuthOpSettling`** — listens to Better Auth's `$sessionSignal` to detect when an auth operation (sign-out, etc.) or tab-refocus refetch is in progress. Used for: (a) skipping the transient guard for known auth operations (prevents `isLoading` bounce on sign-out), and (b) making `fetchAccessToken` await settling before deciding (prevents both 401 on sign-out and auth flash on tab refocus).
- **`beforeNavigate` bridge (50ms)** — bridges the 10ms gap between `signIn()` completing and Better Auth's `$sessionSignal` firing (delayed by `setTimeout(10ms)` in proxy.mjs). Sets `sessionPending = true` during client-side navigation when `sessionData` is null, preventing a flash of unauthenticated content.
- **`fetchAccessToken`** — calls `authClient.convex.token()` to obtain a Convex JWT. Skips the HTTP request when the session was previously available and is now cleared (`sessionHasBeenAvailable && !currentSession`). When `authOperationPending` is true, awaits the settling promise then re-checks the session: survived → proceed (tab refocus), cleared → skip (sign-out, no 401).
- **`useAuth`** — reads both convex-svelte's auth context (`isLoading`, `isAuthenticated`) and the Better Auth context (`fetchAccessToken`).
- **`getAuthState` / `getServerState`** — SvelteKit server-side helpers that read Better Auth session from cookies for SSR `initialState`.
- **`createSvelteKitHandler`** — proxies Better Auth API requests to the Convex site URL.

**Key principle**: convex-better-auth-svelte adds **only** Better Auth–specific logic. All generic auth state management (isConvexAuthenticated state machine, context, getters) lives in convex-svelte.

## Responsibility boundary

| Concern                                       | convex-svelte            | convex-better-auth-svelte               |
| --------------------------------------------- | ------------------------ | --------------------------------------- |
| ConvexClient setup                            | ✅ `setupConvex`         | delegates to convex-svelte              |
| Auth state machine                            | ✅ `setupAuth`           | delegates to convex-svelte              |
| `isLoading` / `isAuthenticated`               | ✅ getter in `setupAuth` | reads from convex-svelte context        |
| Stale detection (provider changed, no effect) | ✅ in `isLoading` getter | —                                       |
| Session atom subscription                     | —                        | ✅ `createSvelteAuthClientBrowser`      |
| Transient guard (flash prevention)            | —                        | ✅ in session subscription              |
| Auth operation tracking (bounce + 401 + flash) | —                        | ✅ `$store.listen` + `isAuthOpSettling` |
| Navigation bridge (sign-in gap)               | —                        | ✅ `beforeNavigate` + 50ms timer        |
| `fetchAccessToken`                            | generic parameter        | ✅ `authClient.convex.token()`          |
| SSR state from cookies                        | generic `initialState`   | ✅ `getAuthState` / `getServerState`    |
| `useQuery` / `usePaginatedQuery`              | ✅                       | re-exports from convex-svelte           |
| External session (device auth, CLI)           | —                        | ✅ `externalSession` option             |
| One-time token verification                   | —                        | ✅ `handleOneTimeToken`                 |

## Timing mechanisms in convex-better-auth-svelte

Three distinct mechanisms protect against Better Auth's async timing quirks:

1. **Transient guard (150ms)** — Better Auth's session atom briefly emits `{ data: null, isPending: false }` during client-side navigation before re-settling. The guard temporarily reports `sessionPending = true`, giving `setupAuth` a loading phase instead of a flash to unauthenticated. Skipped for known auth operations via `isAuthOpSettling`.

2. **`authOperationPending` + `isAuthOpSettling`** — `$store.listen('$sessionSignal')` detects when `$sessionSignal` fires while authenticated. The flag is set and a settling promise is created. Cleared when the session atom finishes refetching (`isRefetching = false`), resolving the promise. Used for: (a) skipping the transient guard on sign-out (prevents `isLoading` bounce), and (b) making `fetchAccessToken` **await** settling before deciding. After settling, `fetchAccessToken` re-checks the session: still valid → proceed (tab refocus), cleared → skip (sign-out, no 401). This avoids both the auth flash on tab refocus (caused by immediate skip) and the 401 on sign-out (caused by no skip).

3. **`beforeNavigate` bridge (50ms)** — Better Auth's proxy toggles `$sessionSignal` via `setTimeout(10ms)` after `signIn()` completes. During this 10ms gap, `goto()` can navigate to a new page with stale `sessionData = null`. The bridge sets `sessionPending = true` during navigation when no session exists, giving the atom time to settle.

**Note**: These mechanisms access undocumented Better Auth internals (`$store.listen('$sessionSignal')`, `isRefetching` on the session atom). If Better Auth changes these, the protections silently degrade to the old behavior (401 in console, brief `isLoading` flicker) — not a crash.

## When making changes

- If the change is about **how auth state transitions work** (effect branches, getter logic, `setAuth` calls, SSR seeding, stale detection) → change **convex-svelte**.
- If the change is about **how Better Auth session maps to auth provider state** (subscription, transient guard, authOperationPending, beforeNavigate bridge, fetchAccessToken, cookie parsing) → change **convex-better-auth-svelte**.
- Always run tests in **both** repos after changes to convex-svelte (`pnpm test` in each).
- After changing convex-svelte: rebuild (`pnpm package && pnpm pack`), copy tarball to `convex-better-auth-svelte/node_modules_local/`, clear Vite cache (`rm -rf node_modules/.vite`), reinstall (`pnpm install --force`).
