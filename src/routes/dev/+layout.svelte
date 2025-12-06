<script lang="ts">
	import { createSvelteAuthClient } from '$lib/svelte/index.js';
	import { authClient } from '$lib/auth-client.js';

	let { children, data } = $props();
	// createSvelteAuthClient({ authClient });
	createSvelteAuthClient({ authClient, getServerState: () => data.authState });
</script>

{@render children()}
