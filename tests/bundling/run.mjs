// Bundling check: installs the packed library into small SvelteKit 2 and 3
// apps and verifies, in `vite dev` and a production build, that the Convex
// client createSvelteAuthClient creates is disabled on the server (no
// WebSocket) and enabled in the browser.
//
// Unit tests can't cover this: whether the client counts as "in the browser"
// is decided by how Vite resolves packages for each environment.
//
// Usage: pnpm package && pnpm test:bundling

import { spawn, execSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '../..');
const here = import.meta.dirname;
const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// Versions of the library's peers come from the repo, so the fixtures follow it.
const PEERS = ['svelte', 'convex', 'convex-svelte', 'better-auth', '@convex-dev/better-auth'];

const work = mkdtempSync(join(tmpdir(), 'cbas-bundling-'));
execSync(`pnpm pack --pack-destination ${work}`, { cwd: root, stdio: 'ignore' });
const tarball = join(
	work,
	readdirSync(work).find((file) => file.endsWith('.tgz'))
);

function run(cmd, cwd) {
	try {
		execSync(cmd, { cwd, stdio: 'pipe' });
	} catch (error) {
		process.stderr.write(error.stdout ?? '');
		process.stderr.write(error.stderr ?? '');
		throw error;
	}
}

function prepare(fixture) {
	const dir = join(work, fixture);
	cpSync(join(here, 'app'), dir, { recursive: true });
	cpSync(join(here, fixture), dir, { recursive: true });

	const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
	for (const name of PEERS) pkg.devDependencies[name] = rootPkg.devDependencies[name];
	pkg.devDependencies['@mmailaender/convex-better-auth-svelte'] = `file:${tarball}`;
	writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, '\t'));

	// better-auth declares an optional SvelteKit 2 peer that npm treats as a conflict.
	run('npm install --no-audit --no-fund --legacy-peer-deps', dir);
	return dir;
}

async function waitFor(url) {
	for (let i = 0; i < 240; i++) {
		try {
			await fetch(url);
			return;
		} catch {
			await new Promise((r) => setTimeout(r, 500));
		}
	}
	throw new Error(`Server at ${url} did not start`);
}

async function probe(url, browser) {
	const html = await (await fetch(url)).text();
	const ssrDisabled = html.match(/id="disabled">([^<]*)/)?.[1];

	const page = await browser.newPage();
	await page.addInitScript(() => {
		window.__browserWebSockets = 0;
		const Native = window.WebSocket;
		window.WebSocket = class extends Native {
			constructor(...args) {
				window.__browserWebSockets++;
				super(...args);
			}
		};
	});
	await page.goto(url);
	await page.waitForFunction(() => window.__convexDisabled !== undefined);
	await page.waitForTimeout(500);
	const browserDisabled = await page.evaluate(() => window.__convexDisabled);
	const browserWebSockets = await page.evaluate(() => window.__browserWebSockets);
	await page.close();

	const serverWebSockets = Number(await (await fetch(`${url}__server-websockets`)).text());
	return { ssrDisabled, serverWebSockets, browserDisabled, browserWebSockets };
}

async function check(dir, mode, port, browser) {
	if (mode === 'prod') run('npx vite build', dir);
	const server =
		mode === 'dev'
			? spawn('npx', ['vite', 'dev', '--port', String(port), '--strictPort'], {
					cwd: dir,
					detached: true,
					stdio: 'ignore'
				})
			: spawn('node', ['build'], {
					cwd: dir,
					detached: true,
					stdio: 'ignore',
					env: { ...process.env, PORT: String(port) }
				});
	try {
		const url = `http://localhost:${port}/`;
		await waitFor(url);
		return await probe(url, browser);
	} finally {
		process.kill(-server.pid);
	}
}

const results = [];
const browser = await chromium.launch();
let port = 5600;
try {
	for (const fixture of ['kit3', 'kit2']) {
		const dir = prepare(fixture);
		const kit = JSON.parse(
			readFileSync(join(dir, 'node_modules/@sveltejs/kit/package.json'), 'utf8')
		).version;
		for (const mode of ['dev', 'prod']) {
			const r = await check(dir, mode, port++, browser);
			const ok =
				r.ssrDisabled === 'true' &&
				r.serverWebSockets === 0 &&
				r.browserDisabled === false &&
				r.browserWebSockets > 0;
			results.push({ kit, mode, ...r, ok });
		}
	}
} finally {
	await browser.close();
}

console.table(results);
if (results.some((r) => !r.ok)) {
	console.error('Bundling check failed: see the rows with ok = false.');
	process.exit(1);
}
