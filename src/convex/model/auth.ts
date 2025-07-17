import { convexAdapter } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { betterAuthComponent } from "../auth";
import { type GenericCtx } from "../_generated/server";

const siteUrl = process.env.CONVEX_SITE_URL;
const trustedOrigins = process.env.TRUSTED_ORIGINS?.split(",") ?? [];

export const createAuth = (ctx: GenericCtx) =>
  // Configure your Better Auth instance here
  betterAuth({
    // All auth requests will be proxied through your sveltekit server
    baseURL: siteUrl,
    database: convexAdapter(ctx, betterAuthComponent),
    trustedOrigins,

    // Simple non-verified email/password to get started
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      // The Convex plugin is required
      convex(),
    ],
  });