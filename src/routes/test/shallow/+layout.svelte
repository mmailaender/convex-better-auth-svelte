<script lang="ts">
	/**
	 * Shallow routing layout - client-only auth, so a signed-out user has no session
	 * and the navigation guard in createSvelteAuthClient is armed.
	 */
	import { createSvelteAuthClient } from '#lib/svelte/index.js';
	import { authClient } from '#lib/auth-client.js';

	let { children } = $props();

	createSvelteAuthClient({ authClient });
</script>

{@render children()}
