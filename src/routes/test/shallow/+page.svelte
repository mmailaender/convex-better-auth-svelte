<script lang="ts">
	/**
	 * Shallow routing test page.
	 *
	 * `goto(..., { shallow: true })` keeps the current page, so the navigation
	 * guard must not flip isLoading. A regular navigation to the same route is the
	 * control: it does arm the guard for a signed-out user.
	 */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { useAuth } from '#lib/svelte/index.js';

	const auth = useAuth();
</script>

<div class="mx-auto max-w-2xl p-8">
	<h1 class="mb-6 text-2xl font-bold">Shallow Routing Test</h1>

	<ul class="mb-6 space-y-1 rounded bg-gray-100 p-4 text-sm">
		<li data-testid="is-loading"><strong>isLoading:</strong> {auth.isLoading}</li>
		<li data-testid="is-authenticated">
			<strong>isAuthenticated:</strong>
			{auth.isAuthenticated}
		</li>
		<li data-testid="panel"><strong>panel:</strong> {page.state.panel ?? 'closed'}</li>
	</ul>

	<div class="flex gap-2">
		<button
			data-testid="shallow-nav"
			class="rounded bg-blue-600 px-4 py-2 text-white"
			onclick={() => goto('?panel=open', { shallow: true, state: { panel: 'open' } })}
		>
			Open panel (shallow)
		</button>
		<button
			data-testid="regular-nav"
			class="rounded bg-gray-600 px-4 py-2 text-white"
			onclick={() => goto('?panel=regular')}
		>
			Regular navigation
		</button>
	</div>
</div>
