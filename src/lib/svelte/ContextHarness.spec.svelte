<script lang="ts">
	import { createSvelteAuthClient, type AuthClient } from './client.svelte.js';

	let { authClient, useAuth }: { authClient: AuthClient; useAuth: () => unknown } = $props();

	// svelte-ignore state_referenced_locally
	createSvelteAuthClient({ authClient });
	// svelte-ignore state_referenced_locally
	useAuth();
</script>
