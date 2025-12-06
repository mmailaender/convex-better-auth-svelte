<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	const navLinks = [
		{ path: '/', label: 'Home' },
		{ path: '/dev', label: 'Dev' },
		{ path: '/test/ssr', label: 'SSR Test' },
		{ path: '/test/client-only', label: 'Client Test' },
		{ path: '/test/queries', label: 'Queries Test' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<header class="bg-white border-b border-gray-200 sticky top-0 z-10">
		<nav class="max-w-4xl mx-auto px-4 py-3">
			<div class="flex items-center justify-between">
				<a href="/" class="font-semibold text-gray-900 hover:text-gray-700">
					convex-better-auth-svelte
				</a>
				<ul class="flex items-center gap-1 text-sm">
					{#each navLinks as link}
						<li>
							<a
								href={link.path}
								class="px-3 py-1.5 rounded-md transition-colors {page.url.pathname === link.path
									? 'bg-gray-100 text-gray-900 font-medium'
									: 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
							>
								{link.label}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</nav>
	</header>

	<main>
		{@render children()}
	</main>
</div>
