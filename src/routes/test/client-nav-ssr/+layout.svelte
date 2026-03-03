<script lang="ts">
	/**
	 * SSR Auth Layout for client-nav test (issue #21 reproduction)
	 * Uses getServerState so hasServerState=true.
	 * When loaded unauthenticated: hasServerAuth=false, hasServerState=true.
	 * This is the key trigger for the bug: after sign-in + goto(),
	 * the pending session falls back to stale hasServerAuth=false,
	 * producing isAuthenticated=false, isLoading=false (the flash).
	 */
	import { createSvelteAuthClient } from '$lib/svelte/index.js';
	import { authClient } from '$lib/auth-client.js';

	let { children, data } = $props();

	// Initialize auth client WITH SSR state — this is the key difference from client-only
	createSvelteAuthClient({ authClient, getServerState: () => data.authState });
</script>

{@render children()}
