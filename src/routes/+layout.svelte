<script lang="ts">
	import '../app.css';
  import favicon from '$lib/assets/favicon.svg';
	import { createSvelteAuthClient } from '$lib/svelte/index.js';
	import { authClient } from '$lib/auth-client.js';

	createSvelteAuthClient({ authClient });

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
