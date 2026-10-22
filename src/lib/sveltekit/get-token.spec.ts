import { describe, it, expect } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import { getSessionCookie } from 'better-auth/cookies';
import { JWT_COOKIE_NAME } from '@convex-dev/better-auth/plugins';

import { getToken } from './index.js';

// getToken(cookies) must find the Convex JWT cookie exactly where Better Auth's
// own reader does, which @convex-dev/better-auth's getToken uses for other
// frameworks, and only while Better Auth's reader finds the session cookie: the
// JWT cookie alone can outlive a sign-out. Unmocked, so a lookup change in Better
// Auth shows up here.

const tokenJars: Record<string, string>[] = [
	{},
	{ 'better-auth.convex_jwt': 'a' },
	{ '__Secure-better-auth.convex_jwt': 'b' },
	{ 'better-auth.convex_jwt': 'plain', '__Secure-better-auth.convex_jwt': 'secure' },
	{ 'better-auth-convex_jwt': 'dash' },
	{ 'myapp.convex_jwt': 'c' },
	{ '__Secure-myapp.convex_jwt': 'd' },
	{ 'myapp-convex_jwt': 'e', 'better-auth.convex_jwt': 'f' }
];
const sessionJars: Record<string, string>[] = [
	{},
	{ 'better-auth.session_token': 's' },
	{ '__Secure-better-auth.session_token': 's' },
	{ 'better-auth-session_token': 's' },
	{ 'myapp.session_token': 's' },
	{ '__Secure-myapp.session_token': 's' }
];
const jars = sessionJars.flatMap((session) => tokenJars.map((token) => ({ ...session, ...token })));

const asCookies = (jar: Record<string, string>) =>
	({ get: (name: string) => jar[name] }) as unknown as Cookies;

const asHeaders = (jar: Record<string, string>) =>
	new Headers({
		cookie: Object.entries(jar)
			.map(([name, value]) => `${name}=${value}`)
			.join('; ')
	});

describe('getToken lookup parity with Better Auth getSessionCookie', () => {
	for (const cookiePrefix of [undefined, 'myapp']) {
		for (const jar of jars) {
			it(`prefix ${cookiePrefix ?? '(default)'}, cookies ${JSON.stringify(jar)}`, () => {
				const headers = asHeaders(jar);
				const expected = getSessionCookie(headers, { cookiePrefix })
					? (getSessionCookie(headers, { cookieName: JWT_COOKIE_NAME, cookiePrefix }) ?? undefined)
					: undefined;

				expect(getToken(asCookies(jar), { cookiePrefix })).toBe(expected);
			});
		}
	}
});
