<script lang="ts">
	import { useAuth } from '$lib/svelte/index.js';

	let { data } = $props();

	const auth = useAuth();
</script>

<div class="mx-auto max-w-2xl p-8">
	<h1 class="mb-6 text-2xl font-bold">SSR Universal Load Test</h1>

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
			<h2 class="mb-2 font-semibold">User Data (from convexLoad in +page.ts)</h2>
			{#if data.currentUser?.data}
				<p data-testid="universal-user-email">{data.currentUser.data.email}</p>
			{:else if data.currentUser?.isLoading}
				<p data-testid="universal-user-loading">Loading...</p>
			{:else}
				<p data-testid="universal-user-none">No user data</p>
			{/if}
		</div>

		<div class="rounded bg-gray-100 p-4" data-testid="ssr-data">
			<h2 class="mb-2 font-semibold">SSR Auth State</h2>
			<p data-testid="ssr-auth-state">
				<strong>authState.isAuthenticated:</strong>
				{data.authState?.isAuthenticated ?? 'undefined'}
			</p>
		</div>
	</div>
</div>
