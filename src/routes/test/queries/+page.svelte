<script lang="ts">
	import { api } from '$convex/_generated/api.js';
	import { useQuery } from 'convex-svelte';
	import { useAuth } from '$lib/svelte/index.js';

	let { data } = $props();

	const auth = useAuth();

	// Public query - always runs, no auth required
	const publicQueryResponse = useQuery(
		api.auth.getPublicData,
		{}, // Always pass args, never skip
		() => ({
			initialData: data.publicData
		})
	);

	// Protected query - only runs when authenticated
	const protectedQueryResponse = useQuery(
		api.auth.getCurrentUser,
		() => (auth.isAuthenticated ? {} : 'skip'),
		() => ({
			initialData: data.protectedData,
			keepPreviousData: true
		})
	);
</script>

<div class="mx-auto max-w-2xl p-8">
	<h1 class="mb-6 text-2xl font-bold">Query Behavior Test</h1>

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

		<div class="rounded bg-blue-50 p-4" data-testid="public-query">
			<h2 class="mb-2 font-semibold">Public Query (always runs)</h2>
			{#if publicQueryResponse.isLoading}
				<p data-testid="public-loading">Loading...</p>
			{:else if publicQueryResponse.data}
				<p data-testid="public-message">{publicQueryResponse.data.message}</p>
				<p class="text-xs text-gray-500" data-testid="public-timestamp">
					Timestamp: {publicQueryResponse.data.timestamp}
				</p>
			{:else}
				<p data-testid="public-error">Error loading public data</p>
			{/if}
		</div>

		<div class="rounded bg-purple-50 p-4" data-testid="protected-query">
			<h2 class="mb-2 font-semibold">Protected Query (auth required)</h2>
			{#if auth.isLoading}
				<p data-testid="protected-auth-loading">Checking auth...</p>
			{:else if !auth.isAuthenticated}
				<p data-testid="protected-skipped">Query skipped - not authenticated</p>
			{:else if protectedQueryResponse.isLoading}
				<p data-testid="protected-loading">Loading user...</p>
			{:else if protectedQueryResponse.data}
				<p data-testid="protected-email">{protectedQueryResponse.data.email}</p>
			{:else}
				<p data-testid="protected-none">No user data</p>
			{/if}
		</div>

		<div class="rounded bg-gray-50 p-4" data-testid="ssr-data">
			<h2 class="mb-2 font-semibold">SSR Initial Data</h2>
			<p data-testid="ssr-public">
				<strong>publicData:</strong>
				{data.publicData?.message ?? 'null'}
			</p>
			<p data-testid="ssr-protected">
				<strong>protectedData:</strong>
				{data.protectedData?.email ?? 'null'}
			</p>
		</div>
	</div>
</div>
