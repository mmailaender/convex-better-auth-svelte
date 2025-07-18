<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { api } from '../convex/_generated/api';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { useAuth } from '$lib/better-auth/client.svelte';

	const convex = useConvexClient();

	// Auth state store
	const auth = useAuth();
	const isLoading = $derived(auth.isLoading);
	const isAuthenticated = $derived(auth.isAuthenticated);

	const currentUserResponse = useQuery(api.auth.getCurrentUser, {});
	let user = $derived(currentUserResponse.data);

	// Sign in/up form state
	let showSignIn = $state(true);
	let name = $state('');
	let email = $state('');
	let password = $state('');

	// Handle form submission
	async function handleSubmit(event: Event) {
		event.preventDefault();

		try {
			if (showSignIn) {
				await authClient.signIn.email(
					{ email, password },
					{
						onError: (ctx) => {
							alert(ctx.error.message);
						},
						onSuccess: () => {
							convex.setAuth(async () => {
								const convexToken = await authClient.convex.token();
								return convexToken.data?.token ?? '';
							});
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
		try {
			await authClient.signOut();
			convex.client.clearAuth();
		} catch (error) {
			console.error('Sign out error:', error);
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
</script>

<div class="flex h-screen flex-col items-center justify-center bg-gray-50">
	{#if isLoading}
		<div class="text-lg text-gray-600">Loading...</div>
	{:else if !isAuthenticated}
		<!-- Sign In Component -->
		<div class="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
			<h2 class="text-2xl font-bold text-center text-gray-800 mb-6">
				{showSignIn ? 'Sign In' : 'Sign Up'}
			</h2>
			
			<form onsubmit={handleSubmit} class="flex flex-col gap-4">
				{#if !showSignIn}
					<input 
						bind:value={name} 
						placeholder="Name" 
						required 
						class="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					/>
				{/if}
				<input 
					type="email" 
					bind:value={email} 
					placeholder="Email" 
					required 
					class="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
				<input 
					type="password" 
					bind:value={password} 
					placeholder="Password" 
					required 
					class="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
				<button 
					type="submit"
					class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors cursor-pointer"
				>
					{showSignIn ? 'Sign in' : 'Sign up'}
				</button>
			</form>

			<p class="mt-4 text-center text-gray-600">
				{showSignIn ? "Don't have an account? " : 'Already have an account? '}
				<button 
					type="button" 
					onclick={toggleSignMode}
					class="text-blue-600 hover:text-blue-800 underline bg-transparent border-none cursor-pointer"
				>
					{showSignIn ? 'Sign up' : 'Sign in'}
				</button>
			</p>
		</div>
	{:else if isAuthenticated}
		<!-- Dashboard Component -->
		<div class="w-full max-w-md p-6 bg-white rounded-lg shadow-md text-center">
			<div class="text-xl font-semibold text-gray-800 mb-4">
				Hello {user?.name}!
			</div>
			<button 
				onclick={signOut}
				class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors cursor-pointer"
			>
				Sign out
			</button>
		</div>
	{/if}
</div>