<script lang="ts">
	/**
	 * Dashboard page for client-nav test (issue #21 reproduction)
	 * Displays auth state after client-side navigation from login page.
	 * The bug: after sign-in + goto(), there's a flash of
	 * isAuthenticated=false/isLoading=false before auth settles.
	 */
	import { api } from '$convex/_generated/api.js';
	import { useQuery } from 'convex-svelte';
	import { useAuth } from '$lib/svelte/index.js';
	import { authClient } from '$lib/auth-client.js';

	const auth = useAuth();

	// Protected query without SSR initial data
	const currentUserResponse = useQuery(api.auth.getCurrentUser, () =>
		auth.isAuthenticated ? {} : 'skip'
	);

	async function handleSignOut() {
		await authClient.signOut();
	}
</script>

<div class="mx-auto max-w-2xl p-8">
	<h1 class="mb-6 text-2xl font-bold">Client Nav - Dashboard (Issue #21)</h1>
	<p class="mb-6 text-gray-600">Target page after client-side navigation from login.</p>

	<div class="space-y-4">
		<div class="rounded bg-gray-100 p-4" data-testid="auth-state">
			<h2 class="mb-2 font-semibold">Auth State</h2>
			<ul class="space-y-1 text-sm">
				<li data-testid="is-loading">
					<strong>isLoading:</strong>
					{auth.isLoading}
				</li>
				<li data-testid="is-authenticated">
					<strong>isAuthenticated:</strong>
					{auth.isAuthenticated}
				</li>
			</ul>
		</div>

		<div class="rounded bg-gray-100 p-4" data-testid="user-data">
			<h2 class="mb-2 font-semibold">User Data</h2>
			{#if auth.isLoading}
				<p data-testid="user-loading">Loading...</p>
			{:else if currentUserResponse.isLoading}
				<p data-testid="user-loading">Loading user...</p>
			{:else if currentUserResponse.data}
				<p data-testid="user-email">{currentUserResponse.data.email}</p>
			{:else}
				<p data-testid="user-none">No user data</p>
			{/if}
		</div>

		<!-- Visual state indicator for easy debugging -->
		{#if auth.isLoading}
			<div class="rounded bg-yellow-100 p-4" data-testid="loading-state">
				<p>Loading authentication...</p>
			</div>
		{:else if auth.isAuthenticated}
			<div class="rounded bg-green-100 p-4" data-testid="authenticated-state">
				<p class="mb-2">You are signed in!</p>
				<button
					onclick={handleSignOut}
					class="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
					data-testid="sign-out-button"
				>
					Sign Out
				</button>
			</div>
		{:else}
			<div class="rounded bg-red-100 p-4" data-testid="unauthenticated-state">
				<p>Not authenticated.</p>
				<a
					href="/test/client-nav/login"
					class="mt-2 inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
				>
					Go to Login
				</a>
			</div>
		{/if}
	</div>
</div>
