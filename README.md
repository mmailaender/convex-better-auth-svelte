# Getting Started

## Prerequisites

You'll first need a project on Convex where `npx convex dev` has been run on your local machine. If you don't have one, run `npm create convex@latest` to get started, and [check out the docs](https://docs.convex.dev/getting-started/installation) to learn more.

> It's helpful to have the Convex dev server (`npx convex dev`) running in the background while setting up, otherwise you'll see type errors that won't resolve until you run it.

## Installation

Install the component
To get started, install the component, a pinned version of Better Auth, and the latest version of Convex

> This component requires Convex `1.25.0` or later.

```bash
pnpm add @convex-dev/better-auth
pnpm add @mmailaender/convex-better-auth-svelte@latest
pnpm add better-auth@1.2.12 --save-exact
pnpm add convex@latest
```

Add the component to your application.

`src/convex/convex.config.ts`

```ts
import { defineApp } from 'convex/server';
import betterAuth from '@convex-dev/better-auth/convex.config';

const app = defineApp();
app.use(betterAuth);

export default app;
```

Add a `convex/auth.config.ts` file to configure Better Auth as an authentication provider:

```ts
export default {
	providers: [
		{
			// Your Convex site URL is provided in a system
			// environment variable
			domain: process.env.CONVEX_SITE_URL,

			// Application ID has to be "convex"
			applicationID: 'convex'
		}
	]
};
```

### Set environment variables

Generate a secret for encryption and generating hashes. Use the command below if you have openssl installed, or use the button to generate a random value instead. Or generate your own however you like.

```bash
npx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
```

Add TRUSTED_ORIGINS to convex as env variable and set the value to "http://localhost:5173" for your dev environment (If you're using vite).

```bash
npx convex env set TRUSTED_ORIGINS="http://localhost:5173"
```

Add the Convex site URL environment variable to the .env.local file created by npx convex dev. It will be picked up by your framework dev server.

```bash
npx convex env set PUBLIC_CONVEX_SITE_URL="https://quick-dog-123.convex.site"
```

### Initialize Better Auth

> The Better Auth component uses the Convex database adapter, which handles all things schema and migration related automatically.

First, add a users table to your schema. Name it whatever you like. Better Auth has its own user table that tracks basic user data, so your application user table only needs fields specific to your app (or none at all).

`src/convex/schema.ts`

```ts
import { defineSchema, defineTable } from 'convex/server';

export default defineSchema({
	users: defineTable({
		// Fields are optional
	})
});
```

Create your Better Auth instance.

Note: Some Typescript errors will show until you save the file.

`src/lib/auth.ts`

```ts
import { convexAdapter } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth } from 'better-auth';
import { betterAuthComponent } from '../convex/auth.js';
import { type GenericCtx } from '../convex/_generated/server.js';

const siteUrl = process.env.SITE_URL;

export const createAuth = (ctx: GenericCtx) =>
	// Configure your Better Auth instance here
	betterAuth({
		// All auth requests will be proxied through your sveltekit server
		baseURL: siteUrl,
		database: convexAdapter(ctx, betterAuthComponent),

		// Simple non-verified email/password to get started
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false
		},

    socialProviders: {
      github: {
        enabled: true,
        clientId: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      }
    },
		plugins: [
			// The Convex plugin is required
			convex()
		]
	});
```

`src/convex/auth.ts`

```ts
import { BetterAuth, type AuthFunctions, type PublicAuthFunctions } from '@convex-dev/better-auth';
import { api, components, internal } from './_generated/api.js';
import { query } from './_generated/server.js';
import type { Id, DataModel } from './_generated/dataModel.js';

// Typesafe way to pass Convex functions defined in this file
const authFunctions: AuthFunctions = internal.auth;
const publicAuthFunctions: PublicAuthFunctions = api.auth;

// Initialize the component
export const betterAuthComponent = new BetterAuth(components.betterAuth, {
	authFunctions,
	publicAuthFunctions
});

// These are required named exports
export const { createUser, updateUser, deleteUser, createSession, isAuthenticated } =
	betterAuthComponent.createAuthFunctions<DataModel>({
		// Must create a user and return the user id
		onCreateUser: async (ctx) => {
			return ctx.db.insert('users', {});
		},

		// Delete the user when they are deleted from Better Auth
		onDeleteUser: async (ctx, userId) => {
			await ctx.db.delete(userId as Id<'users'>);
		}
	});

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		// Get user data from Better Auth - email, name, image, etc.
		const userMetadata = await betterAuthComponent.getAuthUser(ctx);
		if (!userMetadata) {
			return null;
		}
		// Get user data from your application's database
		// (skip this if you have no fields in your users table schema)
		const user = await ctx.db.get(userMetadata.userId as Id<'users'>);
		return {
			...user,
			...userMetadata
		};
	}
});
```

### Create a Better Auth client instance

Create a Better Auth client instance for interacting with the Better Auth server from your client.

`lib/auth-client.ts`

```ts
import { createAuthClient } from 'better-auth/svelte';
import { convexClient } from '@convex-dev/better-auth/client/plugins';

export const authClient = createAuthClient({
	plugins: [convexClient()]
});
```

### Mount handlers
Register Better Auth route handlers on your Convex deployment.

`src/convex/http.ts`
```ts
import { httpRouter } from 'convex/server'
import { betterAuthComponent } from './auth'
import { createAuth } from '../lib/auth'

const http = httpRouter()

betterAuthComponent.registerRoutes(http, createAuth)

export default http
```

Set up route handlers to proxy auth requests from your sveltekit server to your Convex deployment.

`api/aut/[...all]/+server.ts`
```ts
import { createSvelteKitHandler } from '$lib/sveltekit/index.js';

export const { GET, POST } = createSvelteKitHandler();
```

## Set up Convex client provider

`src/routes/+layout.svelte`
```ts
import '../app.css';
import { createSvelteAuthClient } from '$lib/svelte/index.js';
import { authClient } from '$lib/auth-client.js';

createSvelteAuthClient({ authClient });

let { children } = $props();
```

## Basic Usage
Follow the [Better Auth documentation](https://www.better-auth.com/docs/basic-usage) for basic usage. The Convex component provides a compatibility layer so things generally work as expected.

Some things that do work differently with this component are documented here.

### Signing in
Below is a basic example of a working auth flow with email (unverified) and password.

`src/routes/+page.svelte`

```html
<script lang="ts">
	import { authClient } from '$lib/auth-client.js';
	import { api } from '$convex/_generated/api.js';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { useAuth } from '$lib/svelte/index.js';

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
	<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
		<h2 class="mb-6 text-center text-2xl font-bold text-gray-800">
			{showSignIn ? 'Sign In' : 'Sign Up'}
		</h2>

		<form onsubmit="{handleSubmit}" class="flex flex-col gap-4">
			{#if !showSignIn}
			<input
				bind:value="{name}"
				placeholder="Name"
				required
				class="rounded-md border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
			/>
			{/if}
			<input
				type="email"
				bind:value="{email}"
				placeholder="Email"
				required
				class="rounded-md border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
			/>
			<input
				type="password"
				bind:value="{password}"
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
				onclick="{toggleSignMode}"
				class="cursor-pointer border-none bg-transparent text-blue-600 underline hover:text-blue-800"
			>
				{showSignIn ? 'Sign up' : 'Sign in'}
			</button>
		</p>
	</div>
	{:else if isAuthenticated}
	<!-- Dashboard Component -->
	<div class="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-md">
		<div class="mb-4 text-xl font-semibold text-gray-800">Hello {user?.name}!</div>

		<!-- Demo: Access Token Section -->
		<div class="mb-4 rounded-md bg-gray-50 p-4">
			<h3 class="mb-2 text-sm font-medium text-gray-700">Access Token Demo</h3>
			<button
				onclick="{fetchToken}"
				disabled="{tokenLoading}"
				class="cursor-pointer rounded-md bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			>
				{tokenLoading ? 'Fetching...' : 'Fetch Access Token'}
			</button>
			{#if accessToken}
			<div class="mt-2 truncate rounded border bg-white p-2 text-xs break-all text-gray-600">
				{accessToken}
			</div>
			{/if}
		</div>

		<button
			onclick="{signOut}"
			class="cursor-pointer rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
		>
			Sign out
		</button>
	</div>
	{/if}
</div>
```
