<script lang="ts">
	import '../app.css';
	import { createSvelteAuthClient } from '$lib/better-auth/client.svelte';
	import { authClient } from '$lib/auth-client';


	createSvelteAuthClient({ authClient })

	let { children } = $props();
</script>

{@render children()}
