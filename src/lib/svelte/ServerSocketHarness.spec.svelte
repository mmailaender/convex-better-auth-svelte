<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { createSvelteAuthClient, type AuthClient } from './client.svelte.js';

	let { authClient, onClient }: { authClient: AuthClient; onClient: (disabled: boolean) => void } =
		$props();

	// No initConvex(): createSvelteAuthClient creates the ConvexClient itself.
	// svelte-ignore state_referenced_locally
	createSvelteAuthClient({ authClient, convexUrl: 'https://happy-animal-123.convex.cloud' });
	// svelte-ignore state_referenced_locally
	onClient(useConvexClient().disabled);
</script>
