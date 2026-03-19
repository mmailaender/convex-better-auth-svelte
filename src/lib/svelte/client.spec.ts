import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure-logic helpers for the reactive getter that createSvelteAuthClientBrowser
// builds and passes to setupAuth() from @mmailaender/convex-svelte.
//
// The auth state machine (setAuth/clearAuth toggling, SSR hydration, Convex
// backend confirmation) now lives in the base library's setupAuth(). These
// tests verify that our library correctly maps Better Auth session state to
// the ConvexAuthProvider shape that setupAuth expects.
// ---------------------------------------------------------------------------

interface BetterAuthSessionState {
	data: unknown;
	isPending: boolean;
}

/**
 * Mirrors the reactive getter built in createSvelteAuthClientBrowser:
 *
 * ```ts
 * setupAuth(() => ({
 *     isLoading: sessionPending,
 *     isAuthenticated: !!sessionData,
 *     fetchAccessToken
 * }));
 * ```
 */
function computeAuthProvider(session: BetterAuthSessionState) {
	return {
		isLoading: session.isPending,
		isAuthenticated: !!session.data
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reactive getter: Better Auth session → ConvexAuthProvider mapping', () => {
	it('initial load (pending, no data) → loading, not authenticated', () => {
		const p = computeAuthProvider({ data: null, isPending: true });
		expect(p.isLoading).toBe(true);
		expect(p.isAuthenticated).toBe(false);
	});

	it('session settled with user data → not loading, authenticated', () => {
		const p = computeAuthProvider({ data: { user: { id: '1' } }, isPending: false });
		expect(p.isLoading).toBe(false);
		expect(p.isAuthenticated).toBe(true);
	});

	it('session settled without data → not loading, not authenticated', () => {
		const p = computeAuthProvider({ data: null, isPending: false });
		expect(p.isLoading).toBe(false);
		expect(p.isAuthenticated).toBe(false);
	});

	it('sign-out pending (data still present) → loading, still authenticated', () => {
		// During sign-out, Better Auth sets isPending=true while data is still the old session.
		// This prevents setupAuth from calling clearAuth() prematurely.
		const p = computeAuthProvider({ data: { user: { id: '1' } }, isPending: true });
		expect(p.isLoading).toBe(true);
		expect(p.isAuthenticated).toBe(true);
	});

	it('sign-out complete (data cleared) → not loading, not authenticated', () => {
		const p = computeAuthProvider({ data: null, isPending: false });
		expect(p.isLoading).toBe(false);
		expect(p.isAuthenticated).toBe(false);
	});
});

describe('fetchAccessToken: SSR hydration — sessionHasBeenAvailable guard', () => {
	// Mirrors the sessionHasBeenAvailable logic in makeFetchAccessTokenBrowser:
	//
	// During initial hydration, getSessionData() returns null because the
	// Better Auth session atom hasn't settled yet.  The old code would bail
	// with `return null` — causing the synchronous client.setAuth() call
	// (from setupAuth) to report "no token" → unauthenticated subscriptions.
	//
	// The fix tracks whether the session has ever been available.  Only skip
	// token fetches when the session was previously available and is now gone
	// (sign-out).  During initial hydration, allow the fetch — browser cookies
	// are still valid for the token endpoint.

	function shouldSkipTokenFetch(
		sessionHasBeenAvailable: boolean,
		currentSession: unknown
	): boolean {
		return sessionHasBeenAvailable && !currentSession;
	}

	it('allows token fetch during initial hydration (session not yet loaded)', () => {
		// Session atom hasn't settled — getSessionData() returns null.
		// sessionHasBeenAvailable is false (never been available).
		// Should NOT skip — cookies are valid, just need to fetch.
		expect(shouldSkipTokenFetch(false, null)).toBe(false);
	});

	it('allows token fetch when session is available', () => {
		// Session is loaded and available.
		expect(shouldSkipTokenFetch(true, { user: { id: '1' } })).toBe(false);
	});

	it('skips token fetch after sign-out (session was available, now cleared)', () => {
		// Session was previously available (sign-in happened),
		// but is now null (sign-out completed).  Should skip to avoid 401.
		expect(shouldSkipTokenFetch(true, null)).toBe(true);
	});

	it('tracks sessionHasBeenAvailable correctly through lifecycle', () => {
		// Simulates the full lifecycle: hydration → session loads → sign-out
		let sessionHasBeenAvailable = false;

		const updateSessionAvailability = (session: unknown) => {
			if (session) {
				sessionHasBeenAvailable = true;
			}
		};

		// 1. Hydration: session not loaded yet → should NOT skip
		updateSessionAvailability(null);
		expect(shouldSkipTokenFetch(sessionHasBeenAvailable, null)).toBe(false);

		// 2. Session loads → should NOT skip (session is available)
		const sessionData = { user: { id: '1' } };
		updateSessionAvailability(sessionData);
		expect(shouldSkipTokenFetch(sessionHasBeenAvailable, sessionData)).toBe(false);

		// 3. Sign-out → should skip (session was available, now cleared)
		updateSessionAvailability(null);
		expect(shouldSkipTokenFetch(sessionHasBeenAvailable, null)).toBe(true);
	});

	it('sessionHasBeenAvailable stays true once set (never resets)', () => {
		let sessionHasBeenAvailable = false;

		// Session becomes available
		sessionHasBeenAvailable = true;

		// Even if session clears, the flag stays true
		// (This prevents the guard from allowing fetches after sign-out)
		expect(sessionHasBeenAvailable).toBe(true);

		// Null session check
		expect(shouldSkipTokenFetch(sessionHasBeenAvailable, null)).toBe(true);
	});
});

describe('fetchAccessToken: tab refocus must not cause auth flash', () => {
	// This test mirrors the ACTUAL skip logic in makeFetchAccessTokenBrowser
	// and asserts the DESIRED behavior.
	//
	// On tab refocus, Better Auth's session-refresh manager toggles
	// $sessionSignal to trigger a session revalidation.  This is the SAME
	// signal that proxy.mjs toggles after auth operations (sign-out, etc.).
	// Our $store.listen('$sessionSignal') handler sets authOperationPending
	// when the signal fires while sessionData is present.
	//
	// If fetchAccessToken blocks (returns null) when authOperationPending
	// is true, the Convex AuthenticationManager calls onChange(false) →
	// isConvexAuthenticated = false → { isLoading: false, isAuthenticated: false }
	// → redirect to login page.  This is the bug we are reproducing.

	/**
	 * Mirrors the skip logic in makeFetchAccessTokenBrowser EXACTLY.
	 * Returns true when the function would return null (skip the fetch).
	 *
	 * When authOperationPending is true, the real code awaits a settling
	 * promise, then re-checks the session.  We simulate this by accepting
	 * `sessionAfterSettle` — the session state AFTER the auth op settled.
	 */
	function wouldSkipTokenFetch(
		sessionHasBeenAvailable: boolean,
		currentSession: unknown,
		authOperationPending: boolean,
		sessionAfterSettle?: unknown
	): boolean {
		if (sessionHasBeenAvailable && !currentSession) return true;
		if (authOperationPending) {
			// Await settling, then re-check session
			const settled = sessionAfterSettle !== undefined ? sessionAfterSettle : currentSession;
			if (sessionHasBeenAvailable && !settled) return true;
			return false;
		}
		return false;
	}

	it('must NOT skip token fetch on tab refocus (session valid, authOperationPending true)', () => {
		// Tab refocus scenario:
		// 1. User is authenticated, session data present
		// 2. Tab becomes visible → session-refresh.mjs toggles $sessionSignal
		// 3. Our $store.listen handler sets authOperationPending = true
		// 4. Convex client's WebSocket reconnects, calls fetchAccessToken
		// 5. fetchAccessToken waits for settling → session still valid → proceed
		const skip = wouldSkipTokenFetch(
			true, // sessionHasBeenAvailable
			{ user: { id: '1' } }, // currentSession — still valid
			true, // authOperationPending — set by $sessionSignal
			{ user: { id: '1' } } // sessionAfterSettle — still valid (tab refocus)
		);
		expect(skip).toBe(false);
	});

	it('must skip token fetch after sign-out (session cleared after settling)', () => {
		// Sign-out: authOperationPending true, session valid at first,
		// but after awaiting settle the session is null.
		const skip = wouldSkipTokenFetch(
			true, // sessionHasBeenAvailable
			{ user: { id: '1' } }, // currentSession — still valid during the window
			true, // authOperationPending
			null // sessionAfterSettle — session cleared (sign-out)
		);
		expect(skip).toBe(true);
	});

	it('must skip token fetch when session already cleared', () => {
		// After sign-out: session atom settled with null, no pending op.
		expect(wouldSkipTokenFetch(true, null, false)).toBe(true);
	});

	it('must allow token fetch during initial hydration', () => {
		expect(wouldSkipTokenFetch(false, null, false)).toBe(false);
	});
});

describe('transient guard: $sessionSignal on tab refocus vs sign-out', () => {
	// Better Auth's $sessionSignal is shared between:
	// 1. Auth operations (sign-out via proxy.mjs onSuccess → 10ms timeout)
	// 2. Session refresh (tab refocus via session-refresh.mjs triggerRefetch)
	//
	// The transient guard + isAuthOpSettling logic must handle both correctly.

	interface SubscriptionState {
		sessionData: unknown;
		sessionPending: boolean;
		wasAuthenticated: boolean;
		authOperationPending: boolean;
	}

	function processSessionEmission(
		state: SubscriptionState,
		session: { data: unknown; isPending: boolean; isRefetching: boolean }
	): SubscriptionState {
		const isAuthOpSettling = state.authOperationPending && !session.isRefetching;
		const newState = { ...state };
		if (isAuthOpSettling) {
			newState.authOperationPending = false;
		}
		if (session.data) {
			newState.wasAuthenticated = true;
		}
		if (state.wasAuthenticated && !session.data && !session.isPending) {
			newState.sessionData = null;
			if (isAuthOpSettling) {
				newState.sessionPending = false;
				newState.wasAuthenticated = false;
			} else {
				newState.sessionPending = true; // transient guard active
			}
			return newState;
		}
		newState.sessionData = session.data;
		newState.sessionPending = session.isPending;
		return newState;
	}

	it('tab refocus: session stays valid, no state change', () => {
		// Tab refocus → $sessionSignal toggles → authOperationPending = true
		let state: SubscriptionState = {
			sessionData: { user: { id: '1' } },
			sessionPending: false,
			wasAuthenticated: true,
			authOperationPending: true // set by $sessionSignal listener
		};

		// onRequest: data stays, isRefetching = true
		state = processSessionEmission(state, {
			data: { user: { id: '1' } },
			isPending: false,
			isRefetching: true
		});
		expect(state.sessionData).toEqual({ user: { id: '1' } });
		expect(state.sessionPending).toBe(false);
		expect(state.authOperationPending).toBe(true); // not cleared yet

		// onSuccess: fresh data, isRefetching = false
		state = processSessionEmission(state, {
			data: { user: { id: '1' } },
			isPending: false,
			isRefetching: false
		});
		expect(state.sessionData).toEqual({ user: { id: '1' } });
		expect(state.sessionPending).toBe(false);
		expect(state.authOperationPending).toBe(false); // cleared
		// Provider state never changed → setupAuth effect never re-runs → no flash
	});

	it('sign-out: transient guard skipped via isAuthOpSettling', () => {
		let state: SubscriptionState = {
			sessionData: { user: { id: '1' } },
			sessionPending: false,
			wasAuthenticated: true,
			authOperationPending: true // set by $sessionSignal from proxy.mjs
		};

		// onRequest: data stays, isRefetching = true
		state = processSessionEmission(state, {
			data: { user: { id: '1' } },
			isPending: false,
			isRefetching: true
		});

		// onSuccess with null (session gone after sign-out): isRefetching = false
		state = processSessionEmission(state, {
			data: null,
			isPending: false,
			isRefetching: false
		});
		expect(state.sessionData).toBe(null);
		expect(state.sessionPending).toBe(false); // guard skipped
		expect(state.wasAuthenticated).toBe(false); // reset
		expect(state.authOperationPending).toBe(false);
	});
});

describe('sign-in lifecycle: auth provider state transitions', () => {
	it('produces correct ConvexAuthProvider sequence during sign-in', () => {
		const steps: { label: string; session: BetterAuthSessionState }[] = [
			{ label: '1. Initial load', session: { data: null, isPending: true } },
			{ label: '2. No session found', session: { data: null, isPending: false } },
			{ label: '3. Sign-in started (pending)', session: { data: null, isPending: true } },
			{
				label: '4. Session arrives',
				session: { data: { user: { id: '1' } }, isPending: false }
			}
		];

		const results = steps.map((s) => ({
			label: s.label,
			...computeAuthProvider(s.session)
		}));

		expect(results).toEqual([
			{ label: '1. Initial load', isLoading: true, isAuthenticated: false },
			{ label: '2. No session found', isLoading: false, isAuthenticated: false },
			{ label: '3. Sign-in started (pending)', isLoading: true, isAuthenticated: false },
			{ label: '4. Session arrives', isLoading: false, isAuthenticated: true }
		]);
	});

	it('produces correct ConvexAuthProvider sequence during sign-out', () => {
		const steps: { label: string; session: BetterAuthSessionState }[] = [
			{
				label: '1. Authenticated',
				session: { data: { user: { id: '1' } }, isPending: false }
			},
			{
				label: '2. Sign-out pending (data still present)',
				session: { data: { user: { id: '1' } }, isPending: true }
			},
			{ label: '3. Sign-out complete', session: { data: null, isPending: false } }
		];

		const results = steps.map((s) => ({
			label: s.label,
			...computeAuthProvider(s.session)
		}));

		expect(results).toEqual([
			{ label: '1. Authenticated', isLoading: false, isAuthenticated: true },
			// Key: during pending, isAuthenticated stays true (data still present)
			// This prevents setupAuth from calling clearAuth() prematurely
			{ label: '2. Sign-out pending (data still present)', isLoading: true, isAuthenticated: true },
			{ label: '3. Sign-out complete', isLoading: false, isAuthenticated: false }
		]);
	});
});
