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

import { createSvelteKitHandler } from './index.js';

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

		const incomingRequest = new Request(
			'https://app.example.com/api/auth/callback?code=abc123',
			{ headers: { host: 'app.example.com' } }
		);

		await GET({ request: incomingRequest } as Parameters<typeof GET>[0]);

		expect(capturedRequest).toBeDefined();
		expect(capturedRequest!.url).toBe(
			'https://convex.example.com/api/auth/callback?code=abc123'
		);
	});
});
