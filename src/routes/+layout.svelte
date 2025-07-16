<script lang="ts">
	import '../app.css';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	
	import { setupConvex, useConvexClient } from 'convex-svelte';
	import { authClient } from '$convex/model/authclient';

	setupConvex(PUBLIC_CONVEX_URL);
	const convex = useConvexClient();
	convex.setAuth(async () => {
		const convexToken = await authClient.convex.token();
		return convexToken.data?.token ?? '';
	});

	let { children } = $props();
</script>

{@render children()}
