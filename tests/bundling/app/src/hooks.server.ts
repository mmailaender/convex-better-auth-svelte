import type { Handle } from '@sveltejs/kit';

// Count WebSockets created on the server. A stand-in avoids real connections.
let opened = 0;
globalThis.WebSocket = class {
	readyState = 0;
	constructor() {
		opened++;
	}
	close() {}
	send() {}
} as unknown as typeof WebSocket;

export const handle: Handle = ({ event, resolve }) =>
	event.url.pathname === '/__server-websockets' ? new Response(String(opened)) : resolve(event);
