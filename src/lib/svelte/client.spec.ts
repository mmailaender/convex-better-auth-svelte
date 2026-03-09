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
