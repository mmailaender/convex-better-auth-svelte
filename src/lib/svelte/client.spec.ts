import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure-logic helpers extracted from createSvelteAuthClientBrowser.
// These mirror the $derived computations in client.svelte.ts so we can
// unit-test them without mounting a Svelte component.
// ---------------------------------------------------------------------------

interface AuthState {
	hasServerAuth: boolean;
	hasServerState: boolean;
	sessionData: unknown;
	sessionPending: boolean;
	hasEverSettled: boolean;
	isConvexAuthenticated: boolean | null;
}

function computeDerived(s: AuthState) {
	const isAuthProviderAuthenticated = s.sessionData !== null;
	// hasEverSettled is a one-way latch: once the client has settled,
	// we never fall back to (potentially stale) server state.
	const clientHasTakenOver = s.hasEverSettled;

	// THE FIX – shouldSetAuth as a memoized $derived outside the $effect.
	// Before the fix this was  `hasServerAuth || isAuthProviderAuthenticated`
	// computed inside the $effect body, which kept it `true` even on sign-out
	// when hasServerAuth was a stale constant.
	const shouldSetAuth = clientHasTakenOver
		? isAuthProviderAuthenticated
		: s.hasServerAuth || isAuthProviderAuthenticated;

	const isAuthenticated = clientHasTakenOver
		? isAuthProviderAuthenticated && (s.isConvexAuthenticated ?? false)
		: s.hasServerAuth;

	const isLoading = clientHasTakenOver
		? s.sessionPending || (isAuthProviderAuthenticated && s.isConvexAuthenticated === null)
		: !s.hasServerState;

	return {
		isAuthProviderAuthenticated,
		clientHasTakenOver,
		shouldSetAuth,
		isAuthenticated,
		isLoading
	};
}

/** Returns what the ORIGINAL (broken) code computed for shouldSetAuth. */
function computeShouldSetAuthOriginal(s: AuthState) {
	const isAuthProviderAuthenticated = s.sessionData !== null;
	// Bug: hasServerAuth is a constant – once true, always true.
	return s.hasServerAuth || isAuthProviderAuthenticated;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('shouldSetAuth computation (the core fix)', () => {
	it('trusts server auth during hydration (clientHasTakenOver=false)', () => {
		const d = computeDerived({
			hasServerAuth: true,
			hasServerState: true,
			sessionData: null,
			sessionPending: true,
			hasEverSettled: false,
			isConvexAuthenticated: true
		});
		expect(d.clientHasTakenOver).toBe(false);
		expect(d.shouldSetAuth).toBe(true);
	});

	it('stays true when client settles as authenticated', () => {
		const d = computeDerived({
			hasServerAuth: true,
			hasServerState: true,
			sessionData: { user: { id: '1' } },
			sessionPending: false,
			hasEverSettled: true,
			isConvexAuthenticated: true
		});
		expect(d.clientHasTakenOver).toBe(true);
		expect(d.shouldSetAuth).toBe(true);
	});

	it('becomes false on sign-out even when hasServerAuth=true (regression)', () => {
		const d = computeDerived({
			hasServerAuth: true,
			hasServerState: true,
			sessionData: null, // signed out
			sessionPending: false,
			hasEverSettled: true,
			isConvexAuthenticated: false
		});
		expect(d.clientHasTakenOver).toBe(true);
		expect(d.isAuthProviderAuthenticated).toBe(false);
		expect(d.shouldSetAuth).toBe(false); // ← was true before fix
	});

	it('becomes true again on subsequent sign-in', () => {
		const d = computeDerived({
			hasServerAuth: true,
			hasServerState: true,
			sessionData: { user: { id: '2' } },
			sessionPending: false,
			hasEverSettled: true,
			isConvexAuthenticated: null
		});
		expect(d.clientHasTakenOver).toBe(true);
		expect(d.shouldSetAuth).toBe(true);
	});

	it('ORIGINAL BUG: old computation never returns false when hasServerAuth=true', () => {
		// This documents the exact bug that was fixed. The old code always
		// returned true because `hasServerAuth || X` is true when hasServerAuth=true.
		const signedOutState: AuthState = {
			hasServerAuth: true,
			hasServerState: true,
			sessionData: null,
			sessionPending: false,
			hasEverSettled: true,
			isConvexAuthenticated: false
		};
		expect(computeShouldSetAuthOriginal(signedOutState)).toBe(true); // old: bug
		expect(computeDerived(signedOutState).shouldSetAuth).toBe(false); // new: fixed
	});
});

describe('shouldSetAuth – hasServerAuth=false (fresh page load)', () => {
	it('is false initially (no auth)', () => {
		const d = computeDerived({
			hasServerAuth: false,
			hasServerState: true,
			sessionData: null,
			sessionPending: true,
			hasEverSettled: false,
			isConvexAuthenticated: null
		});
		expect(d.shouldSetAuth).toBe(false);
	});

	it('becomes true when user signs in', () => {
		const d = computeDerived({
			hasServerAuth: false,
			hasServerState: true,
			sessionData: { user: { id: '1' } },
			sessionPending: false,
			hasEverSettled: true,
			isConvexAuthenticated: null
		});
		expect(d.shouldSetAuth).toBe(true);
	});

	it('becomes false when user signs out', () => {
		const d = computeDerived({
			hasServerAuth: false,
			hasServerState: true,
			sessionData: null,
			sessionPending: false,
			hasEverSettled: true,
			isConvexAuthenticated: false
		});
		expect(d.shouldSetAuth).toBe(false);
	});
});

describe('isAuthenticated derivation', () => {
	it('trusts server state before client takes over', () => {
		expect(
			computeDerived({
				hasServerAuth: true,
				hasServerState: true,
				sessionData: null,
				sessionPending: true,
				hasEverSettled: false,
				isConvexAuthenticated: true
			}).isAuthenticated
		).toBe(true);
	});

	it('requires both provider and Convex confirmation after takeover', () => {
		expect(
			computeDerived({
				hasServerAuth: true,
				hasServerState: true,
				sessionData: { user: { id: '1' } },
				sessionPending: false,
				hasEverSettled: true,
				isConvexAuthenticated: null // not yet confirmed
			}).isAuthenticated
		).toBe(false);

		expect(
			computeDerived({
				hasServerAuth: true,
				hasServerState: true,
				sessionData: { user: { id: '1' } },
				sessionPending: false,
				hasEverSettled: true,
				isConvexAuthenticated: true
			}).isAuthenticated
		).toBe(true);
	});

	it('is false after sign-out', () => {
		expect(
			computeDerived({
				hasServerAuth: true,
				hasServerState: true,
				sessionData: null,
				sessionPending: false,
				hasEverSettled: true,
				isConvexAuthenticated: false
			}).isAuthenticated
		).toBe(false);
	});
});

describe('isLoading derivation', () => {
	it('is false during hydration when server state exists', () => {
		expect(
			computeDerived({
				hasServerAuth: true,
				hasServerState: true,
				sessionData: null,
				sessionPending: true,
				hasEverSettled: false,
				isConvexAuthenticated: true
			}).isLoading
		).toBe(false);
	});

	it('is true during hydration when NO server state exists', () => {
		expect(
			computeDerived({
				hasServerAuth: false,
				hasServerState: false,
				sessionData: null,
				sessionPending: true,
				hasEverSettled: false,
				isConvexAuthenticated: null
			}).isLoading
		).toBe(true);
	});

	it('is true after takeover while waiting for Convex confirmation', () => {
		expect(
			computeDerived({
				hasServerAuth: true,
				hasServerState: true,
				sessionData: { user: { id: '1' } },
				sessionPending: false,
				hasEverSettled: true,
				isConvexAuthenticated: null // pending
			}).isLoading
		).toBe(true);
	});

	it('is false after takeover once Convex confirms', () => {
		expect(
			computeDerived({
				hasServerAuth: true,
				hasServerState: true,
				sessionData: { user: { id: '1' } },
				sessionPending: false,
				hasEverSettled: true,
				isConvexAuthenticated: true
			}).isLoading
		).toBe(false);
	});
});

describe('effect branching (state machine)', () => {
	// The $effect calls setAuth when shouldSetAuth is true, clearAuth when false.
	// It only re-runs when the memoized shouldSetAuth value changes.
	// This test verifies the transitions produce the correct sequence of calls.

	type Action = 'setAuth' | 'clearAuth';

	function effectAction(shouldSetAuth: boolean): Action {
		return shouldSetAuth ? 'setAuth' : 'clearAuth';
	}

	it('reload-signed-in lifecycle produces correct call sequence', () => {
		const steps: { label: string; state: AuthState }[] = [
			{
				label: 'hydration (server auth)',
				state: {
					hasServerAuth: true,
					hasServerState: true,
					sessionData: null,
					sessionPending: true,
					hasEverSettled: false,
					isConvexAuthenticated: true
				}
			},
			{
				label: 'session settles authenticated',
				state: {
					hasServerAuth: true,
					hasServerState: true,
					sessionData: { user: { id: '1' } },
					sessionPending: false,
					hasEverSettled: true,
					isConvexAuthenticated: true
				}
			},
			{
				label: 'user signs out',
				state: {
					hasServerAuth: true,
					hasServerState: true,
					sessionData: null,
					sessionPending: false,
					hasEverSettled: true,
					isConvexAuthenticated: false
				}
			},
			{
				label: 'user signs in again',
				state: {
					hasServerAuth: true,
					hasServerState: true,
					sessionData: { user: { id: '2' } },
					sessionPending: false,
					hasEverSettled: true,
					isConvexAuthenticated: null
				}
			}
		];

		// Compute shouldSetAuth at each step and collect only the transitions
		// (i.e. when the value changes), which is when the $effect re-runs.
		const actions: { label: string; action: Action }[] = [];
		let prev: boolean | undefined;

		for (const step of steps) {
			const { shouldSetAuth } = computeDerived(step.state);
			if (prev === undefined || shouldSetAuth !== prev) {
				actions.push({ label: step.label, action: effectAction(shouldSetAuth) });
			}
			prev = shouldSetAuth;
		}

		expect(actions).toEqual([
			{ label: 'hydration (server auth)', action: 'setAuth' },
			// session settles: shouldSetAuth stays true → no re-run (correct!)
			{ label: 'user signs out', action: 'clearAuth' },
			{ label: 'user signs in again', action: 'setAuth' }
		]);
	});

	it('ORIGINAL BUG: old code never transitions to clearAuth', () => {
		// With the old `hasServerAuth || isAuthProviderAuthenticated` inside
		// the $effect, shouldSetAuth was always true → clearAuth unreachable.
		const signedOutState: AuthState = {
			hasServerAuth: true,
			hasServerState: true,
			sessionData: null,
			sessionPending: false,
			hasEverSettled: true,
			isConvexAuthenticated: false
		};
		const signedInState: AuthState = {
			...signedOutState,
			sessionData: { user: { id: '2' } },
			isConvexAuthenticated: null
		};

		// Old code: both states produce shouldSetAuth=true → no transition
		expect(computeShouldSetAuthOriginal(signedOutState)).toBe(true);
		expect(computeShouldSetAuthOriginal(signedInState)).toBe(true);
		// Effect never re-runs → no clearAuth, no fresh setAuth → stuck

		// Fixed code: sign-out transitions to false
		expect(computeDerived(signedOutState).shouldSetAuth).toBe(false);
		expect(computeDerived(signedInState).shouldSetAuth).toBe(true);
	});
});

describe('Issue #21: no unauthenticated flash after sign-in + client-side navigation', () => {
	// Scenario: SSR layout loaded while unauthenticated (hasServerAuth=false, hasServerState=true).
	// User signs in → session goes pending → clientHasTakenOver must stay true
	// so we don't fall back to stale hasServerAuth=false.

	it('session pending after settlement keeps clientHasTakenOver=true (latch)', () => {
		// After first settlement, session goes pending again (e.g. sign-in triggers re-fetch)
		const d = computeDerived({
			hasServerAuth: false,
			hasServerState: true,
			sessionData: null,
			sessionPending: true,
			hasEverSettled: true, // already settled once before
			isConvexAuthenticated: null
		});
		// Key assertion: clientHasTakenOver stays true even though session is pending
		expect(d.clientHasTakenOver).toBe(true);
		// Uses client logic: isLoading = sessionPending || ... = true (shows spinner)
		expect(d.isLoading).toBe(true);
		// NOT the buggy fallback: isLoading = !hasServerState = false
	});

	it('SSR unauthenticated + session pending after sign-in shows loading, not unauthenticated', () => {
		// This is the exact bug scenario from issue #21:
		// SSR says "not authed", user signs in, session goes pending during goto()
		const d = computeDerived({
			hasServerAuth: false,
			hasServerState: true,
			sessionData: null,
			sessionPending: true,
			hasEverSettled: true,
			isConvexAuthenticated: null
		});

		// MUST NOT show isAuthenticated=false + isLoading=false (the unauthenticated flash)
		const isFlash = !d.isAuthenticated && !d.isLoading;
		expect(isFlash).toBe(false);

		// Should show loading state instead
		expect(d.isLoading).toBe(true);
	});

	it('sign-in lifecycle with SSR unauthenticated produces no flash', () => {
		const steps: { label: string; state: AuthState }[] = [
			{
				label: '1. SSR hydration (unauthenticated)',
				state: {
					hasServerAuth: false,
					hasServerState: true,
					sessionData: null,
					sessionPending: true,
					hasEverSettled: false,
					isConvexAuthenticated: null
				}
			},
			{
				label: '2. Client settles as unauthenticated',
				state: {
					hasServerAuth: false,
					hasServerState: true,
					sessionData: null,
					sessionPending: false,
					hasEverSettled: true,
					isConvexAuthenticated: null
				}
			},
			{
				label: '3. User signs in, session goes pending',
				state: {
					hasServerAuth: false,
					hasServerState: true,
					sessionData: null,
					sessionPending: true,
					hasEverSettled: true,
					isConvexAuthenticated: null
				}
			},
			{
				label: '4. Session settles with user data',
				state: {
					hasServerAuth: false,
					hasServerState: true,
					sessionData: { user: { id: '1' } },
					sessionPending: false,
					hasEverSettled: true,
					isConvexAuthenticated: null
				}
			},
			{
				label: '5. Convex backend confirms',
				state: {
					hasServerAuth: false,
					hasServerState: true,
					sessionData: { user: { id: '1' } },
					sessionPending: false,
					hasEverSettled: true,
					isConvexAuthenticated: true
				}
			}
		];

		// After step 2 (initial settlement), there should never be a state
		// where isAuthenticated=false AND isLoading=false (the unauthenticated flash)
		for (const step of steps.slice(2)) {
			const d = computeDerived(step.state);
			const isFlash = !d.isAuthenticated && !d.isLoading;
			expect(isFlash, `Flash detected at "${step.label}"`).toBe(false);
		}

		// Final state should be authenticated
		const final = computeDerived(steps[steps.length - 1].state);
		expect(final.isAuthenticated).toBe(true);
		expect(final.isLoading).toBe(false);
	});
});
