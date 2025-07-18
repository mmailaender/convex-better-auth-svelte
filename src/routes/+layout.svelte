<script lang="ts">
	import '../app.css';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	
	import { setupConvex } from 'convex-svelte';


	setupConvex(PUBLIC_CONVEX_URL);

	let { children } = $props();
</script>

{@render children()}
