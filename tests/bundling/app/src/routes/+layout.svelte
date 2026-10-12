<script lang="ts">
	import { createAuthClient } from 'better-auth/svelte';
	import { convexClient } from '@convex-dev/better-auth/client/plugins';
	import { createSvelteAuthClient } from '@mmailaender/convex-better-auth-svelte/svelte';
	import { useConvexClient } from 'convex-svelte';

	let { children } = $props();

	// No initConvex(): createSvelteAuthClient creates the ConvexClient itself.
	createSvelteAuthClient({
		authClient: createAuthClient({ plugins: [convexClient()] }),
		convexUrl: 'https://happy-animal-123.convex.cloud'
	});

	const client = useConvexClient();
	if (typeof window !== 'undefined') {
		(window as unknown as { __convexDisabled: boolean }).__convexDisabled = client.disabled;
	}
</script>

<p id="disabled">{client.disabled}</p>
{@render children()}
