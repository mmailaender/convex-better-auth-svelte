import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetConvexUrl = vi.fn<() => string>();
vi.mock('convex-svelte/sveltekit', () => ({
	getConvexUrl: () => mockGetConvexUrl()
}));

import { deriveConvexSiteUrl, resolveConvexSiteUrl, resolveConvexUrl } from './convex-url.js';

const notInitialized = () => {
	throw new Error('Convex URL not set. Call setupConvex() or initConvex() first.');
};

describe('deriveConvexSiteUrl', () => {
	it('maps a Convex Cloud URL to its convex.site URL', () => {
		expect(deriveConvexSiteUrl('https://happy-animal-123.convex.cloud')).toBe(
			'https://happy-animal-123.convex.site'
		);
	});

	it('keeps the region segment of regional deployments', () => {
		expect(deriveConvexSiteUrl('https://happy-animal-123.eu-west-1.convex.cloud/')).toBe(
			'https://happy-animal-123.eu-west-1.convex.site'
		);
	});

	it.each([
		'http://127.0.0.1:3210',
		'https://convex.example.com',
		'https://example.convex.cloud.attacker.com'
	])('returns undefined for %s', (url) => {
		expect(deriveConvexSiteUrl(url)).toBeUndefined();
	});
});

describe('resolveConvexUrl', () => {
	beforeEach(() => {
		mockGetConvexUrl.mockReset();
	});

	it('prefers the explicit URL', () => {
		mockGetConvexUrl.mockReturnValue('https://happy-animal-123.convex.cloud');

		expect(resolveConvexUrl('http://127.0.0.1:3210')).toBe('http://127.0.0.1:3210');
	});

	it('falls back to the URL registered with initConvex()', () => {
		mockGetConvexUrl.mockReturnValue('https://happy-animal-123.convex.cloud');

		expect(resolveConvexUrl(undefined)).toBe('https://happy-animal-123.convex.cloud');
	});

	it('explains both options when neither is available', () => {
		mockGetConvexUrl.mockImplementation(notInitialized);

		expect(() => resolveConvexUrl(undefined)).toThrow(/Pass `convexUrl`.*initConvex/);
	});
});

describe('resolveConvexSiteUrl', () => {
	beforeEach(() => {
		mockGetConvexUrl.mockReset();
	});

	it('prefers the explicit URL', () => {
		expect(resolveConvexSiteUrl('http://127.0.0.1:3211')).toBe('http://127.0.0.1:3211');
		expect(mockGetConvexUrl).not.toHaveBeenCalled();
	});

	it('derives the URL from the initConvex() URL', () => {
		mockGetConvexUrl.mockReturnValue('https://happy-animal-123.convex.cloud');

		expect(resolveConvexSiteUrl(undefined)).toBe('https://happy-animal-123.convex.site');
	});

	it('asks for convexSiteUrl when the deployment URL is not Convex Cloud', () => {
		mockGetConvexUrl.mockReturnValue('http://127.0.0.1:3210');

		expect(() => resolveConvexSiteUrl(undefined)).toThrow(/Pass `convexSiteUrl`/);
	});

	it('asks for convexSiteUrl when initConvex() was not called', () => {
		mockGetConvexUrl.mockImplementation(notInitialized);

		expect(() => resolveConvexSiteUrl(undefined)).toThrow(/Pass `convexSiteUrl`/);
	});
});
