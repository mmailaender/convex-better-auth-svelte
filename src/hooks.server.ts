import type { Handle } from "@sveltejs/kit";
import { createAuth } from "$convex/auth.js";
import { getToken } from "$lib/sveltekit/index.js";

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.token = await getToken(createAuth, event.cookies);;

  return resolve(event);
};
