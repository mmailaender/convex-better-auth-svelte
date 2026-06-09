import { createClient, type CreateAuth } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { components } from './_generated/api.js';
import { type DataModel } from './_generated/dataModel.js';
import { query } from './_generated/server.js';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import authConfig from './auth.config.js';

const siteUrl = process.env.SITE_URL!;

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth: CreateAuth<DataModel> = (ctx) => {
	const options: BetterAuthOptions = {
		baseURL: siteUrl,
		database: authComponent.adapter(ctx),
		// Configure simple, non-verified email/password to get started
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false
		},
		socialProviders: {
			github: {
				enabled: true,
				clientId: process.env.GITHUB_CLIENT_ID as string,
				clientSecret: process.env.GITHUB_CLIENT_SECRET as string
			}
		},
		plugins: [
			// The Convex plugin is required for Convex compatibility
			convex({
				authConfig,
				jwksRotateOnTokenGenerationError: true
			})
		]
	};

	return betterAuth(options);
};

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		return authComponent.safeGetAuthUser(ctx);
	}
});

// Public query for testing - no auth required
export const getPublicData = query({
	args: {},
	handler: async () => {
		return {
			message: 'This is public data',
			timestamp: Date.now()
		};
	}
});
