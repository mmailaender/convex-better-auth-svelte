<script lang="ts">
	/**
	 * Login page for SSR client-nav test (issue #21 reproduction)
	 * Signs in and does a client-side goto('/test/client-nav-ssr/dashboard')
	 *
	 * This page is loaded unauthenticated, so the SSR layout captures:
	 *   hasServerState=true, hasServerAuth=false
	 * After sign-in + goto(), the stale hasServerAuth=false causes the flash.
	 */
	import { goto } from '$app/navigation';
	import { useAuth } from '$lib/svelte/index.js';
	import { authClient } from '$lib/auth-client.js';

	const auth = useAuth();

	let email = $state('');
	let password = $state('');
	let isSubmitting = $state(false);
	let signInError = $state('');

	async function handleSignIn(event: Event) {
		event.preventDefault();
		isSubmitting = true;
		signInError = '';
		try {
			const { error } = await authClient.signIn.email({
				email,
				password,
				rememberMe: true
			});
			if (error) {
				signInError = error.message ?? 'Sign in failed';
				return;
			}
			// Client-side navigation — this is the key trigger for the bug
			await goto('/test/client-nav-ssr/dashboard');
		} catch (error) {
			signInError = error instanceof Error ? error.message : 'Sign in failed';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="mx-auto max-w-2xl p-8">
	<h1 class="mb-6 text-2xl font-bold">Client Nav SSR - Login (Issue #21)</h1>
	<p class="mb-6 text-gray-600">
		SSR layout with <code>getServerState</code>. Signs in then does client-side nav.
	</p>

	<div class="space-y-4">
		<div class="rounded bg-gray-100 p-4" data-testid="auth-state">
			<h2 class="mb-2 font-semibold">Auth State</h2>
			<ul class="space-y-1 text-sm">
				<li data-testid="is-loading">
					<strong>isLoading:</strong>
					{auth.isLoading}
				</li>
				<li data-testid="is-authenticated">
					<strong>isAuthenticated:</strong>
					{auth.isAuthenticated}
				</li>
			</ul>
		</div>

		{#if auth.isAuthenticated}
			<div class="rounded bg-green-100 p-4" data-testid="authenticated-state">
				<p>
					Already signed in. <a href="/test/client-nav-ssr/dashboard" class="underline"
						>Go to dashboard</a
					>
				</p>
			</div>
		{:else}
			<form
				onsubmit={handleSignIn}
				class="space-y-4 rounded bg-gray-100 p-4"
				data-testid="sign-in-form"
			>
				<h2 class="font-semibold">Sign In</h2>
				{#if signInError}
					<p class="text-red-600" data-testid="sign-in-error">{signInError}</p>
				{/if}
				<div>
					<label for="email" class="block text-sm font-medium">Email</label>
					<input
						type="email"
						id="email"
						bind:value={email}
						class="mt-1 block w-full rounded border-gray-300 shadow-sm"
						data-testid="email-input"
						required
					/>
				</div>
				<div>
					<label for="password" class="block text-sm font-medium">Password</label>
					<input
						type="password"
						id="password"
						bind:value={password}
						class="mt-1 block w-full rounded border-gray-300 shadow-sm"
						data-testid="password-input"
						required
					/>
				</div>
				<button
					type="submit"
					disabled={isSubmitting}
					class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
					data-testid="sign-in-button"
				>
					{isSubmitting ? 'Signing in...' : 'Sign In & Navigate'}
				</button>
			</form>
		{/if}
	</div>
</div>
