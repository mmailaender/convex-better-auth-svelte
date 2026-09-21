<script lang="ts">
	import { createSvelteAuthClient, type AuthClient } from './client.svelte.js';

	let { authClient }: { authClient: AuthClient } = $props();

	// svelte-ignore state_referenced_locally
	createSvelteAuthClient({ authClient });
</script>
