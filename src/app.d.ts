// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			token: string | undefined;
		}
		// interface PageData {}
		interface PageState {
			panel?: string;
		}
		// interface Platform {}
	}
}

export {};
