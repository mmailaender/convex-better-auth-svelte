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

<div class="max-w-2xl mx-auto py-12 px-4">
	<h1 class="text-3xl font-bold text-gray-900 mb-2">convex-better-auth-svelte</h1>
	<p class="text-gray-600 mb-8">Convex + Better Auth integration for Svelte/SvelteKit</p>

	<!-- Development Section -->
	<section class="mb-10">
		<h2 class="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
			<span class="w-2 h-2 bg-green-500 rounded-full"></span>
			Development
		</h2>
		<div class="space-y-3">
			{#each devRoutes as route}
				<a
					href={route.path}
					class="block p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-green-200 hover:border-green-400"
				>
					<h3 class="text-lg font-semibold text-gray-900">{route.title}</h3>
					<p class="text-sm text-gray-600 mt-1">{route.description}</p>
					<span class="text-xs text-green-600 mt-2 inline-block">{route.path}</span>
				</a>
			{/each}
		</div>
	</section>

	<!-- Test Routes Section -->
	<section class="mb-10">
		<h2 class="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
			<span class="w-2 h-2 bg-purple-500 rounded-full"></span>
			Test Routes
		</h2>
		<div class="space-y-3">
			{#each testRoutes as route}
				<a
					href={route.path}
					class="block p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-purple-200 hover:border-purple-400"
				>
					<h3 class="text-lg font-semibold text-gray-900">{route.title}</h3>
					<p class="text-sm text-gray-600 mt-1">{route.description}</p>
					<span class="text-xs text-purple-600 mt-2 inline-block">{route.path}</span>
				</a>
			{/each}
		</div>
	</section>

	<!-- E2E Tests Info -->
	<section class="p-4 bg-gray-100 rounded-lg border border-gray-200">
		<h3 class="font-semibold text-gray-900 mb-2">Run E2E Tests</h3>
		<p class="text-sm text-gray-600">
			Execute <code class="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-xs">pnpm test:e2e</code> to run all test scenarios with Playwright.
		</p>
	</section>
</div>