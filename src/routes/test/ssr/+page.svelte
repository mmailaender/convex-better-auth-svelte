<script lang="ts">
	import { api } from '$convex/_generated/api.js';
	import { useQuery } from 'convex-svelte';
	import { useAuth } from '$lib/svelte/index.js';
	import { authClient } from '$lib/auth-client.js';

	let { data } = $props();

	const auth = useAuth();

	// Protected query with SSR initial data
	const currentUserResponse = useQuery(
		api.auth.getCurrentUser,
		() => (auth.isAuthenticated ? {} : 'skip'),
		() => ({
			initialData: data.currentUser,
			keepPreviousData: true
		})
	);

	async function handleSignOut() {
		await authClient.signOut();
	}
</script>

<div class="mx-auto max-w-2xl p-8">
	<h1 class="mb-6 text-2xl font-bold">SSR Authentication Test</h1>

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
			{#if currentUserResponse.isLoading}
				<p data-testid="user-loading">Loading user...</p>
			{:else if currentUserResponse.data}
				<p data-testid="user-email">{currentUserResponse.data.email}</p>
			{:else}
				<p data-testid="user-none">No user data</p>
			{/if}
		</div>

		<div class="rounded bg-gray-100 p-4" data-testid="ssr-data">
			<h2 class="mb-2 font-semibold">SSR Initial Data</h2>
			<p data-testid="ssr-auth-state">
				<strong>authState.isAuthenticated:</strong>
				{data.authState?.isAuthenticated ?? 'undefined'}
			</p>
			<p data-testid="ssr-current-user">
				<strong>currentUser:</strong>
				{data.currentUser?.email ?? 'null'}
			</p>
		</div>

		<!-- Actions -->
		<div class="rounded bg-gray-100 p-4" data-testid="actions">
			<h2 class="mb-2 font-semibold">Actions</h2>
			{#if auth.isAuthenticated}
				<button
					onclick={handleSignOut}
					class="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
					data-testid="sign-out-button"
				>
					Sign Out
				</button>
			{:else}
				<p class="text-sm text-gray-600">Sign in via the client-only test page</p>
			{/if}
		</div>
	</div>
</div>
