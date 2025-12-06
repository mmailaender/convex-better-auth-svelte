<script lang="ts">
	import { authClient } from '$lib/auth-client.js';
	import { api } from '$convex/_generated/api.js';
	import { useQuery } from 'convex-svelte';
	import { useAuth } from '$lib/svelte/index.js';

	let { data } = $props();

	// Auth state store
	const auth = useAuth();
	const isLoading = $derived(auth.isLoading);
	const isAuthenticated = $derived(auth.isAuthenticated);
	// const isLoading = $derived(auth.isLoading && !data.currentUser);
	// const isAuthenticated = $derived(auth.isAuthenticated || !!data.currentUser);

	$inspect(auth.isLoading, 'isLoading');
	$inspect(auth.isAuthenticated, 'isAuthenticated');

	const currentUserResponse = useQuery(api.auth.getCurrentUser, () => auth.isAuthenticated ?{} : "skip", () => ({
		initialData: data.currentUser,
    keepPreviousData: true
	}));
	let user = $derived(currentUserResponse.data);
  $inspect(currentUserResponse, "currentUserResponse")
  $inspect(user, "user")

	// Sign in/up form state
	let showSignIn = $state(true);
	let name = $state('');
	let email = $state('');
	let password = $state('');

	// Handle form submission
	async function handlePasswordSubmit(event: Event) {
		event.preventDefault();

		try {
			if (showSignIn) {
				await authClient.signIn.email(
					{ email, password },
					{
						onError: (ctx) => {
							alert(ctx.error.message);
						}
					}
				);
			} else {
				await authClient.signUp.email(
					{ name, email, password },
					{
						onError: (ctx) => {
							alert(ctx.error.message);
						}
					}
				);
			}
		} catch (error) {
			console.error('Authentication error:', error);
		}
	}

	// Sign out function
	async function signOut() {
		const result = await authClient.signOut();
		if (result.error) {
			console.error('Sign out error:', result.error);
		}
	}

	// Toggle between sign in and sign up
	function toggleSignMode() {
		showSignIn = !showSignIn;
		// Clear form fields when toggling
		name = '';
		email = '';
		password = '';
	}

	// Demo: Fetch access token
	let accessToken = $state<string | null>(null);
	let tokenLoading = $state(false);

	async function fetchToken() {
		tokenLoading = true;
		try {
			const token = await auth.fetchAccessToken({ forceRefreshToken: true });
			accessToken = token;
		} catch (error) {
			console.error('Error fetching access token:', error);
			accessToken = 'Error fetching token';
		} finally {
			tokenLoading = false;
		}
	}
</script>

<div class="flex h-screen flex-col items-center justify-center bg-gray-50">
	{#if isLoading}
		<div class="text-lg text-gray-600">Loading...</div>
	{:else if !isAuthenticated}
		<!-- Sign In Component -->
		<div class="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-6 shadow-md">
			<h2 class="mb-6 text-center text-2xl font-bold text-gray-800">
				{showSignIn ? 'Sign In' : 'Sign Up'}
			</h2>

			<form onsubmit={handlePasswordSubmit} class="flex flex-col gap-4">
				{#if !showSignIn}
					<input
						bind:value={name}
						placeholder="Name"
						required
						class="rounded-md border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
					/>
				{/if}
				<input
					type="email"
					bind:value={email}
					placeholder="Email"
					required
					class="rounded-md border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
				<input
					type="password"
					bind:value={password}
					placeholder="Password"
					required
					class="rounded-md border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
				<button
					type="submit"
					class="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
				>
					{showSignIn ? 'Sign in' : 'Sign up'}
				</button>
			</form>

			<p class="mt-4 text-center text-gray-600">
				{showSignIn ? "Don't have an account? " : 'Already have an account? '}
				<button
					type="button"
					onclick={toggleSignMode}
					class="cursor-pointer border-none bg-transparent text-blue-600 underline hover:text-blue-800"
				>
					{showSignIn ? 'Sign up' : 'Sign in'}
				</button>
			</p>
		</div>
	{:else if isAuthenticated}
		<!-- Dashboard Component -->
		<div class="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-md">
			<div class="mb-4 text-xl font-semibold text-gray-800">
				Hello {user?.name}!
			</div>

			<!-- Demo: Access Token Section -->
			<div class="mb-4 rounded-md bg-gray-50 p-4">
				<h3 class="mb-2 text-sm font-medium text-gray-700">Access Token Demo</h3>
				<button
					onclick={fetchToken}
					disabled={tokenLoading}
					class="cursor-pointer rounded-md bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					{tokenLoading ? 'Fetching...' : 'Fetch Access Token'}
				</button>
				{#if accessToken}
					<div class="mt-2 rounded border bg-white p-2 text-xs break-all text-gray-600">
						{accessToken.length > 50 ? accessToken.substring(0, 50) + '...' : accessToken}
					</div>
				{/if}
			</div>

			<button
				onclick={signOut}
				class="cursor-pointer rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
			>
				Sign out
			</button>
		</div>
	{/if}
</div>
