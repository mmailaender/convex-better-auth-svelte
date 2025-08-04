<script lang="ts">
	import '../app.css';
	import { createSvelteAuthClient } from '$lib/svelte/index.js';
	import { authClient } from '$lib/auth-client.js';
	import { api } from '$convex/_generated/api.js';

	createSvelteAuthClient({ authClient, api })

	let { children } = $props();
</script>

{@render children()}
