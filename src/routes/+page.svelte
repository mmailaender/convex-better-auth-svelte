<script lang="ts">
	import { authClient } from '$convex/model/authclient';
	import { api } from '../convex/_generated/api';
	import { useQuery } from 'convex-svelte';

	// Auth state store
	const isAuthenticatedResponse = useQuery(api.auth.isAuthenticated, {});
    const isAuthenticated2 = authClient.useSession()
	let authState = $derived(
        $isAuthenticated2.isPending || $isAuthenticated2.isRefetching
        ? 'loading'
        : $isAuthenticated2.data
        ? 'authenticated'
        : 'unauthenticated'
	); // 'loading', 'authenticated', 'unauthenticated'

    $inspect('isAuthenticated2', $isAuthenticated2.data)
    $inspect('isAuthenticatedResponse', isAuthenticatedResponse);
    $inspect('isAuthenticatedResponse.data', isAuthenticatedResponse.data);

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

<div class="flex flex-col items-center justify-center h-screen">
	{#if authState === 'loading'}
		<div>Loading...</div>
	{:else if authState === 'unauthenticated'}
		<!-- Sign In Component -->
		<form onsubmit={handleSubmit}>
			{#if !showSignIn}
				<input bind:value={name} placeholder="Name" required />
			{/if}
			<input type="email" bind:value={email} placeholder="Email" required />
			<input type="password" bind:value={password} placeholder="Password" required />
			<button type="submit">
				{showSignIn ? 'Sign in' : 'Sign up'}
			</button>
		</form>

		<p>
			{showSignIn ? "Don't have an account? " : 'Already have an account? '}
			<button type="button" onclick={toggleSignMode}>
				{showSignIn ? 'Sign up' : 'Sign in'}
			</button>
		</p>
	{:else if authState === 'authenticated'}
		<!-- Dashboard Component -->
		<div>
			<div>Hello {user?.name}!</div>
			<button onclick={signOut}>Sign out</button>
		</div>
	{/if}
</div>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 300px;
	}

	input {
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	button {
		padding: 0.5rem 1rem;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	button:hover {
		background-color: #0056b3;
	}

	button[type='button'] {
		background-color: transparent;
		color: #007bff;
		text-decoration: underline;
	}

	button[type='button']:hover {
		background-color: transparent;
		color: #0056b3;
	}
</style>
