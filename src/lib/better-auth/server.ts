
import { betterAuth } from "better-auth";
import { createCookieGetter } from "better-auth/cookies";
import type { GenericActionCtx } from "convex/server";
import type { RequestHandler } from "@sveltejs/kit";
import { JWT_COOKIE_NAME } from "@convex-dev/better-auth/plugins";
import { PUBLIC_CONVEX_SITE_URL } from "$env/static/public";

export const getToken = async (
  createAuth: (ctx: GenericActionCtx<any>) => ReturnType<typeof betterAuth>,
  cookies: any
) => {
  const auth = createAuth({} as any);
  const createCookie = createCookieGetter(auth.options);
  const cookie = createCookie(JWT_COOKIE_NAME);
  const token = cookies.get(cookie.name);
  return token;
};

const handler = (request: Request, opts?: { convexSiteUrl?: string }) => {
  const requestUrl = new URL(request.url);
  const convexSiteUrl = opts?.convexSiteUrl ?? PUBLIC_CONVEX_SITE_URL;
  
  if (!convexSiteUrl) {
    throw new Error("PUBLIC_CONVEX_SITE_URL environment variable is not set");
  }
  
  const nextUrl = `${convexSiteUrl}${requestUrl.pathname}${requestUrl.search}`;
  const newRequest = new Request(nextUrl, request);
  newRequest.headers.set("accept-encoding", "application/json");
  
  return fetch(newRequest, { method: request.method, redirect: "manual" });
};

export const createSvelteKitHandler = (opts?: { convexSiteUrl?: string }) => {
  const requestHandler: RequestHandler = async ({ request }) => {
    return handler(request, opts);
  };
  
  return {
    GET: requestHandler,
    POST: requestHandler,
  };
};