<script lang="ts">
	const devRoutes = [
		{
			title: 'Development Playground',
			path: '/dev',
			description: 'Full SSR auth demo with sign in/out functionality'
		}
	];

	const testRoutes = [
		{
			title: 'SSR Auth Test',
			path: '/test/ssr',
			description: 'Tests SSR authentication state and hydration'
		},
		{
			title: 'Client-Only Auth Test',
			path: '/test/client-only',
			description: 'Tests client-side only authentication (no SSR)'
		},
		{
			title: 'Query Behavior Test',
			path: '/test/queries',
			description: 'Tests public and protected query behavior'
		}
	];
</script>

<div class="mx-auto max-w-2xl px-4 py-12">
	<h1 class="mb-2 text-3xl font-bold text-gray-900">convex-better-auth-svelte</h1>
	<p class="mb-8 text-gray-600">Convex + Better Auth integration for Svelte/SvelteKit</p>

	<!-- Development Section -->
	<section class="mb-10">
		<h2 class="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-800">
			<span class="h-2 w-2 rounded-full bg-green-500"></span>
			Development
		</h2>
		<div class="space-y-3">
			{#each devRoutes as route}
				<a
					href={route.path}
					class="block rounded-lg border border-green-200 bg-white p-4 shadow transition-shadow hover:border-green-400 hover:shadow-md"
				>
					<h3 class="text-lg font-semibold text-gray-900">{route.title}</h3>
					<p class="mt-1 text-sm text-gray-600">{route.description}</p>
					<span class="mt-2 inline-block text-xs text-green-600">{route.path}</span>
				</a>
			{/each}
		</div>
	</section>

	<!-- Test Routes Section -->
	<section class="mb-10">
		<h2 class="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-800">
			<span class="h-2 w-2 rounded-full bg-purple-500"></span>
			Test Routes
		</h2>
		<div class="space-y-3">
			{#each testRoutes as route}
				<a
					href={route.path}
					class="block rounded-lg border border-purple-200 bg-white p-4 shadow transition-shadow hover:border-purple-400 hover:shadow-md"
				>
					<h3 class="text-lg font-semibold text-gray-900">{route.title}</h3>
					<p class="mt-1 text-sm text-gray-600">{route.description}</p>
					<span class="mt-2 inline-block text-xs text-purple-600">{route.path}</span>
				</a>
			{/each}
		</div>
	</section>

	<!-- E2E Tests Info -->
	<section class="rounded-lg border border-gray-200 bg-gray-100 p-4">
		<h3 class="mb-2 font-semibold text-gray-900">Run E2E Tests</h3>
		<p class="text-sm text-gray-600">
			Execute <code class="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-xs">pnpm test:e2e</code> to
			run all test scenarios with Playwright.
		</p>
	</section>
</div>
