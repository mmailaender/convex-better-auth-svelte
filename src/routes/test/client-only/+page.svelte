<script lang="ts">
	import { api } from '$convex/_generated/api.js';
	import { useQuery } from 'convex-svelte';
	import { useAuth } from '$lib/svelte/index.js';
	import { authClient } from '$lib/auth-client.js';

	const auth = useAuth();

	// Protected query without SSR initial data
	const currentUserResponse = useQuery(api.auth.getCurrentUser, () =>
		auth.isAuthenticated ? {} : 'skip'
	);

	// Form state
	let email = $state('');
	let password = $state('');
	let isSubmitting = $state(false);

	async function handleSignIn(event: Event) {
		event.preventDefault();
		isSubmitting = true;
		try {
			await authClient.signIn.email({ email, password });
		} catch (error) {
			console.error('Sign in error:', error);
		} finally {
			isSubmitting = false;
		}
	}

	async function handleSignOut() {
		await authClient.signOut();
	}
</script>

<div class="p-8 max-w-2xl mx-auto">
	<h1 class="text-2xl font-bold mb-6">Client-Only Authentication Test</h1>
	<p class="text-gray-600 mb-6">This page has NO SSR auth state. Auth is purely client-side.</p>

	<div class="space-y-4">
		<div class="p-4 bg-gray-100 rounded" data-testid="auth-state">
			<h2 class="font-semibold mb-2">Auth State</h2>
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

		<div class="p-4 bg-gray-100 rounded" data-testid="user-data">
			<h2 class="font-semibold mb-2">User Data</h2>
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

		{#if auth.isLoading}
			<div class="p-4 bg-yellow-100 rounded" data-testid="loading-state">
				<p>Checking authentication...</p>
			</div>
		{:else if auth.isAuthenticated}
			<div class="p-4 bg-green-100 rounded" data-testid="authenticated-state">
				<p class="mb-2">You are signed in!</p>
				<button
					onclick={handleSignOut}
					class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
					data-testid="sign-out-button"
				>
					Sign Out
				</button>
			</div>
		{:else}
			<form onsubmit={handleSignIn} class="p-4 bg-gray-100 rounded space-y-4" data-testid="sign-in-form">
				<h2 class="font-semibold">Sign In</h2>
				<div>
					<label for="email" class="block text-sm font-medium">Email</label>
					<input
						type="email"
						id="email"
						bind:value={email}
						class="mt-1 block w-full rounded border-gray-300 shadow-sm"
						data-testid="email-input"
						required
					/>
				</div>
				<div>
					<label for="password" class="block text-sm font-medium">Password</label>
					<input
						type="password"
						id="password"
						bind:value={password}
						class="mt-1 block w-full rounded border-gray-300 shadow-sm"
						data-testid="password-input"
						required
					/>
				</div>
				<button
					type="submit"
					disabled={isSubmitting}
					class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
					data-testid="sign-in-button"
				>
					{isSubmitting ? 'Signing in...' : 'Sign In'}
				</button>
			</form>
		{/if}
	</div>
</div>
