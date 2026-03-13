import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_CONVEX_SITE_URL: 'https://convex.example.com'
}));

vi.mock('better-auth/cookies', () => ({
	createCookieGetter: vi.fn()
}));

vi.mock('@convex-dev/better-auth/plugins', () => ({
	JWT_COOKIE_NAME: 'jwt'
}));

vi.mock('convex/browser', () => ({
	ConvexHttpClient: vi.fn()
}));

import { createCookieGetter } from 'better-auth/cookies';
import { createSvelteKitHandler, getToken } from './index.js';

const mockCreateCookieGetter = vi.mocked(createCookieGetter);

const mockCreateAuth = (() => ({ options: {} })) as unknown as Parameters<typeof getToken>[0];

const mockCookies = (map: Record<string, string>): Parameters<typeof getToken>[1] =>
	({ get: (name: string) => map[name] }) as Parameters<typeof getToken>[1];

describe('getToken', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns the token when primary cookie name matches', async () => {
		mockCreateCookieGetter.mockReturnValue(
			() =>
				({ name: 'better-auth.convex_jwt', attributes: {} }) as ReturnType<
					ReturnType<typeof createCookieGetter>
				>
		);

		const token = await getToken(
			mockCreateAuth,
			mockCookies({ 'better-auth.convex_jwt': 'my-token' })
		);
		expect(token).toBe('my-token');
	});

	it('returns insecure fallback when expected secure cookie is missing', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		mockCreateCookieGetter.mockReturnValue(
			() =>
				({ name: '__Secure-better-auth.convex_jwt', attributes: {} }) as ReturnType<
					ReturnType<typeof createCookieGetter>
				>
		);

		const token = await getToken(
			mockCreateAuth,
			mockCookies({ 'better-auth.convex_jwt': 'insecure-token' })
		);

		expect(token).toBe('insecure-token');
		expect(warnSpy).toHaveBeenCalledOnce();
		expect(warnSpy.mock.calls[0]?.[0]).toContain('reverse proxy');
	});

	it('returns secure fallback when expected insecure cookie is missing', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		mockCreateCookieGetter.mockReturnValue(
			() =>
				({ name: 'better-auth.convex_jwt', attributes: {} }) as ReturnType<
					ReturnType<typeof createCookieGetter>
				>
		);

		const token = await getToken(
			mockCreateAuth,
			mockCookies({ '__Secure-better-auth.convex_jwt': 'secure-token' })
		);

		expect(token).toBe('secure-token');
		expect(warnSpy).toHaveBeenCalledOnce();
		expect(warnSpy.mock.calls[0]?.[0]).toContain('reverse proxy');
	});

	it('returns undefined when neither cookie variant exists', async () => {
		mockCreateCookieGetter.mockReturnValue(
			() =>
				({ name: 'better-auth.convex_jwt', attributes: {} }) as ReturnType<
					ReturnType<typeof createCookieGetter>
				>
		);

		const token = await getToken(mockCreateAuth, mockCookies({}));
		expect(token).toBeUndefined();
	});
});

describe('createSvelteKitHandler', () => {
	let capturedRequest: Request | undefined;

	beforeEach(() => {
		capturedRequest = undefined;
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: Request) => {
				capturedRequest = input;
				return new Response('{}', { status: 200 });
			})
		);
	});

	it('should set host header to target convex URL, not the original request host', async () => {
		const { GET } = createSvelteKitHandler();

		const incomingRequest = new Request('https://app.example.com/api/auth/get-session', {
			headers: { host: 'app.example.com' }
		});

		await GET({ request: incomingRequest } as Parameters<typeof GET>[0]);

		expect(capturedRequest).toBeDefined();
		expect(capturedRequest!.headers.get('host')).toBe('convex.example.com');
	});

	it('should proxy to the correct URL with path and query params', async () => {
		const { GET } = createSvelteKitHandler();

		const incomingRequest = new Request('https://app.example.com/api/auth/callback?code=abc123', {
			headers: { host: 'app.example.com' }
		});

		await GET({ request: incomingRequest } as Parameters<typeof GET>[0]);

		expect(capturedRequest).toBeDefined();
		expect(capturedRequest!.url).toBe('https://convex.example.com/api/auth/callback?code=abc123');
	});
});
