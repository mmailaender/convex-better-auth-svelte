<script lang="ts">
	/**
	 * SSR Auth Layout - uses getServerState for SSR authentication
	 */
	import { createSvelteAuthClient } from '$lib/svelte/index.js';
	import { authClient } from '$lib/auth-client.js';

	let { children, data } = $props();

	// Initialize auth client WITH SSR state
	createSvelteAuthClient({ authClient, getServerState: () => data.authState });
</script>

{@render children()}
