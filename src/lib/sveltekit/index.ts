import { createCookieGetter } from 'better-auth/cookies';
import type { Cookies, RequestHandler } from '@sveltejs/kit';
import { JWT_COOKIE_NAME } from '@convex-dev/better-auth/plugins';
import { PUBLIC_CONVEX_SITE_URL, PUBLIC_CONVEX_URL } from '$env/static/public';
import { ConvexHttpClient, type ConvexClientOptions } from 'convex/browser';
import { getStaticAuth } from '@convex-dev/better-auth';
import type { CreateAuth } from '@convex-dev/better-auth';
import type { GenericDataModel } from "convex/server";

export const getToken = async <DataModel extends GenericDataModel>(
	createAuth: CreateAuth<DataModel>,
	cookies: Cookies
) => {
  const options = getStaticAuth(createAuth).options;
	const createCookie = createCookieGetter(options);
	const cookie = createCookie(JWT_COOKIE_NAME);
	const token = cookies.get(cookie.name);

	if (!token) {
		const isSecure = cookie.name.startsWith('__Secure-');
		const insecureCookieName = cookie.name.replace('__Secure-', '');
		const secureCookieName = isSecure ? cookie.name : `__Secure-${insecureCookieName}`;

		const insecureValue = cookies.get(insecureCookieName);
		const secureValue = cookies.get(secureCookieName);

		// If we expected secure and found insecure set
		if (isSecure && insecureValue) {
			console.warn(
				`Looking for secure cookie "${cookie.name}" but found insecure cookie "${insecureCookieName}".`
			);
		}

		// If we expected insecure and found secure set
		if (!isSecure && secureValue) {
			console.warn(
				`Looking for insecure cookie "${cookie.name}" but found secure cookie "${secureCookieName}".`
			);
		}
	}

	return token;
};

export const createConvexHttpClient = (args: {
	token?: string;
	convexUrl?: string;
	options?: {
		skipConvexDeploymentUrlCheck?: boolean;
		logger?: ConvexClientOptions['logger'];
	};
}) => {
	const client = new ConvexHttpClient(args.convexUrl ?? PUBLIC_CONVEX_URL, args.options);
	if (args.token) client.setAuth(args.token);
	return client;
};

const handler = (request: Request, opts?: { convexSiteUrl?: string }) => {
	const requestUrl = new URL(request.url);
	const convexSiteUrl = opts?.convexSiteUrl ?? PUBLIC_CONVEX_SITE_URL;

	if (!convexSiteUrl) {
		throw new Error('PUBLIC_CONVEX_SITE_URL environment variable is not set');
	}

	const nextUrl = `${convexSiteUrl}${requestUrl.pathname}${requestUrl.search}`;
	const newRequest = new Request(nextUrl, request);
	newRequest.headers.set('accept-encoding', 'application/json');

	return fetch(newRequest, { method: request.method, redirect: 'manual' });
};

export const createSvelteKitHandler = (opts?: { convexSiteUrl?: string }) => {
	const requestHandler: RequestHandler = async ({ request }) => {
		return handler(request, opts);
	};

	return {
		GET: requestHandler,
		POST: requestHandler
	};
};
