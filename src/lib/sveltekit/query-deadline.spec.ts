// @vitest-environment node
import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { makeFunctionReference } from 'convex/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('convex-svelte/sveltekit', () => ({
	_getServerToken: () => undefined,
	getConvexUrl: () => undefined
}));

import { createConvexHttpClient } from './index.js';

// ---------------------------------------------------------------------------
// createConvexHttpClient bounds each query attempt against a real loopback
// server speaking the Convex HTTP protocol. The function name picks how the
// server behaves:
//
// - test:stalled never answers, like a connection that hangs before headers.
// - test:stalledBody sends headers and half a body, then hangs.
// - test:slow answers after twice the deadline; used for a mutation.
// - test:healthy answers at once.
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 200;

const attempts = new Map<string, number>();
const closed = new Map<string, Promise<void>>();

function answer(res: ServerResponse, value: string) {
	res.writeHead(200, { 'content-type': 'application/json' });
	res.end(JSON.stringify({ status: 'success', value, logLines: [] }));
}

const upstream = createServer((req, res) => {
	let body = '';
	req.on('data', (chunk) => (body += chunk));
	req.on('end', () => {
		const name = (JSON.parse(body) as { path: string }).path;
		attempts.set(name, (attempts.get(name) ?? 0) + 1);
		closed.set(name, new Promise((resolve) => res.on('close', () => resolve())));
		if (name === 'test:healthy') return answer(res, 'fresh');
		if (name === 'test:slow') return void setTimeout(() => answer(res, 'written'), TIMEOUT_MS * 2);
		if (name === 'test:stalledBody') {
			res.writeHead(200, { 'content-type': 'application/json' });
			res.write('{"status":"success",');
		}
	});
});

let client: ReturnType<typeof createConvexHttpClient>;

beforeAll(async () => {
	await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
	client = createConvexHttpClient({
		convexUrl: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`,
		options: { queryTimeoutMs: TIMEOUT_MS }
	});
});

afterAll(async () => {
	upstream.closeAllConnections();
	await new Promise((resolve) => upstream.close(resolve));
});

const query = (name: string) => client.query(makeFunctionReference<'query'>(name), {});

describe('createConvexHttpClient query deadline', () => {
	it('fails a query whose response never starts, without retrying it', async () => {
		const startedAt = Date.now();

		await expect(query('test:stalled')).rejects.toMatchObject({ name: 'TimeoutError' });

		expect(Date.now() - startedAt).toBeLessThan(TIMEOUT_MS * 5);
		expect(attempts.get('test:stalled')).toBe(1);
	});

	it('fails a query whose body stalls and closes the upstream request', async () => {
		await expect(query('test:stalledBody')).rejects.toMatchObject({ name: 'TimeoutError' });

		expect(attempts.get('test:stalledBody')).toBe(1);
		await closed.get('test:stalledBody');
	});

	it('answers a healthy query', async () => {
		await expect(query('test:healthy')).resolves.toBe('fresh');
	});

	it('lets a mutation run past the query deadline', async () => {
		await expect(client.mutation(makeFunctionReference<'mutation'>('test:slow'), {})).resolves.toBe(
			'written'
		);
	});
});
