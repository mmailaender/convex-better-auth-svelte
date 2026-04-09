import { createCookieGetter } from 'better-auth/cookies';
import type { Cookies, RequestHandler } from '@sveltejs/kit';
import { JWT_COOKIE_NAME } from '@convex-dev/better-auth/plugins';
import { PUBLIC_CONVEX_SITE_URL, PUBLIC_CONVEX_URL } from '$env/static/public';
import { ConvexHttpClient, type ConvexClientOptions } from 'convex/browser';
import type { CreateAuth, GenericCtx } from '@convex-dev/better-auth';
import type { GenericDataModel } from 'convex/server';
import { _getServerToken } from '@mmailaender/convex-svelte/sveltekit';

/**
 * Initial auth state that can be passed from server to client.
 * Used to avoid loading flash on initial page render.
 */
export type InitialAuthState = {
	isAuthenticated: boolean;
};

const DEFAULT_CONVEX_JWT_COOKIE_NAME = `better-auth.${JWT_COOKIE_NAME}`;
const DEFAULT_CONVEX_JWT_COOKIE_NAMES = [
	`__Secure-${DEFAULT_CONVEX_JWT_COOKIE_NAME}`,
	DEFAULT_CONVEX_JWT_COOKIE_NAME
] as const;
const FORWARDED_AUTH_HEADER_NAMES = new Set([
	'accept',
	'authorization',
	'better-auth-cookie',
	'content-type',
	'cookie',
	'origin',
	'referer',
	'user-agent'
]);

const buildForwardedAuthHeaders = (headers: Headers, nextUrl: string, requestUrl: URL) => {
	const forwardedHeaders = new Headers();

	for (const [headerName, headerValue] of headers.entries()) {
		if (FORWARDED_AUTH_HEADER_NAMES.has(headerName.toLowerCase())) {
			forwardedHeaders.set(headerName, headerValue);
		}
	}

	forwardedHeaders.set('host', new URL(nextUrl).host);
	forwardedHeaders.set('x-forwarded-host', requestUrl.host);
	forwardedHeaders.set('x-forwarded-proto', requestUrl.protocol.replace(/:$/, ''));
	forwardedHeaders.set('x-better-auth-forwarded-host', requestUrl.host);
	forwardedHeaders.set('x-better-auth-forwarded-proto', requestUrl.protocol.replace(/:$/, ''));
	forwardedHeaders.set('accept-encoding', 'identity');
	return forwardedHeaders;
};

const getTokenFromKnownCookieNames = (cookies: Cookies, cookieNames: readonly string[]) => {
	for (const cookieName of cookieNames) {
		const token = cookies.get(cookieName);
		if (token) return token;
	}

	return undefined;
};

export function getToken(cookies: Cookies): string | undefined;
/**
 * @deprecated Pass `cookies` directly instead: `getToken(cookies)`.
 * This overload instantiates `createAuth()` during SvelteKit SSR, which can
 * fail in split-runtime deployments where Better Auth config only exists in
 * the Convex runtime.
 */
export function getToken<DataModel extends GenericDataModel>(
	createAuth: CreateAuth<DataModel>,
	cookies: Cookies
): Promise<string | undefined>;
export function getToken<DataModel extends GenericDataModel>(
	createAuthOrCookies: CreateAuth<DataModel> | Cookies,
	maybeCookies?: Cookies
): string | undefined | Promise<string | undefined> {
	if (!maybeCookies) {
		return getTokenFromKnownCookieNames(
			createAuthOrCookies as Cookies,
			DEFAULT_CONVEX_JWT_COOKIE_NAMES
		);
	}

	return Promise.resolve().then(() => {
		const createAuth = createAuthOrCookies as CreateAuth<DataModel>;
		const cookies = maybeCookies;
		const options = createAuth({} as GenericCtx<DataModel>).options;
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
					`Looking for secure cookie "${cookie.name}" but found insecure cookie "${insecureCookieName}". ` +
						`This typically happens behind a reverse proxy. Consider aligning your baseURL with the external URL.`
				);
				return insecureValue;
			}

			// If we expected insecure and found secure set
			if (!isSecure && secureValue) {
				console.warn(
					`Looking for insecure cookie "${cookie.name}" but found secure cookie "${secureCookieName}". ` +
						`This typically happens behind a reverse proxy. Consider aligning your baseURL with the external URL.`
				);
				return secureValue;
			}
		}

		return token;
	});
}

/**
 * Get initial auth state for SSR.
 *
 * When `withServerConvexToken` is set up in `hooks.server.ts`, call with
 * **no arguments** — the token is read automatically from the request context:
 *
 * @example
 * ```ts
 * // +layout.server.ts (recommended — requires withServerConvexToken in hooks.server.ts)
 * import { getAuthState } from '@mmailaender/convex-better-auth-svelte/sveltekit';
 *
 * export const load = async () => ({
 *   authState: getAuthState()
 * });
 * ```
 *
 * For backward compatibility, you can still pass `createAuth` and `cookies`
 * explicitly. This is useful if you don't use `withServerConvexToken`:
 *
 * @example
 * ```ts
 * // +layout.server.ts (legacy)
 * import { getAuthState } from '@mmailaender/convex-better-auth-svelte/sveltekit';
 * import { createAuth } from '../convex/auth';
 *
 * export const load = async ({ cookies }) => ({
 *   authState: await getAuthState(createAuth, cookies)
 * });
 * ```
 */
export function getAuthState(): InitialAuthState;
/**
 * @deprecated Prefer `getAuthState()` with `withServerConvexToken(...)` in
 * `hooks.server.ts`, or call `getToken(cookies)` directly when you need the
 * raw token during SSR setup.
 */
export function getAuthState<DataModel extends GenericDataModel>(
	createAuth: CreateAuth<DataModel>,
	cookies: Cookies
): Promise<InitialAuthState>;
export function getAuthState<DataModel extends GenericDataModel>(
	createAuth?: CreateAuth<DataModel>,
	cookies?: Cookies
): InitialAuthState | Promise<InitialAuthState> {
	// 1. Try AsyncLocalStorage (zero-cost when withServerConvexToken is active)
	const serverToken = _getServerToken();
	if (serverToken !== undefined) {
		return { isAuthenticated: true };
	}

	// 2. Fall back to cookie-based approach (backward compat)
	if (createAuth && cookies) {
		return getToken(createAuth, cookies).then((token) => ({
			isAuthenticated: !!token
		}));
	}

	// 3. No token context and no cookies — unauthenticated
	return { isAuthenticated: false };
}

export const createConvexHttpClient = (
	args: {
		token?: string;
		convexUrl?: string;
		options?: {
			skipConvexDeploymentUrlCheck?: boolean;
			logger?: ConvexClientOptions['logger'];
		};
	} = {}
) => {
	const client = new ConvexHttpClient(args.convexUrl ?? PUBLIC_CONVEX_URL, args.options);
	const token = args.token ?? _getServerToken();
	if (token) client.setAuth(token);
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
	const forwardedHeaders = buildForwardedAuthHeaders(request.headers, nextUrl, requestUrl);

	for (const headerName of [...newRequest.headers.keys()]) {
		newRequest.headers.delete(headerName);
	}
	for (const [headerName, headerValue] of forwardedHeaders.entries()) {
		newRequest.headers.set(headerName, headerValue);
	}

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
