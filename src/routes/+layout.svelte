<script lang="ts">
	import '../app.css';
	import { createSvelteAuthClient } from '$lib/svelte/index.js';
	import { authClient } from '$lib/auth-client.js';


	createSvelteAuthClient({ authClient })

	let { children } = $props();
</script>

{@render children()}
