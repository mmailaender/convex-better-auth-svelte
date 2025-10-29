# Convex Better Auth – Svelte Adapter

A lightweight **Svelte/SvelteKit** adapter for [`get-convex/better-auth`](https://github.com/get-convex/better-auth).  
It makes authentication **idiomatic**, **type-safe**, and **SSR-ready** in your Convex app.

---

## Getting started

### Option 1 — Ready-to-ship components *(recommended)*

Start with production-ready **Auth and Organization components** built on top of Convex Better Auth.  
All source code is **copied into your project (shadcn-style)** — you own and control every line.

- Includes full sign-in, sign-up, profile, and organization flows  
- Choose what you need: user management only, user + organization, or both  
- Enable or disable features through simple toggles or by editing the code  
- Fully editable and themeable through your design system  
- Saves weeks of setup time while keeping complete flexibility  

**Docs:** [Getting started →](https://etesie.dev/docs/auth/02-getting-started/01-sveltekit)  
**Source:** [github.com/mmailaender/auth →](https://github.com/mmailaender/auth)

<picture>
  <source srcset="./bannerDark.webp" media="(prefers-color-scheme: dark)">
  <source srcset="./banner.webp" media="(prefers-color-scheme: light)">
  <img src="./banner.webp" alt="Auth components preview">
</picture>

---

### Option 2 — Build from scratch

Choose this path only if you have **highly specific requirements** that make even the ready-to-ship setup unsuitable.  
For example, a custom onboarding pipeline or experimental multi-tenant logic.

- Integrate `convex-better-auth` directly and build your own UI  
- Wire up sign-in, sign-up, orgs, and sessions manually  
- Best for projects with unique data models or non-standard flows  

**Docs:** [SvelteKit integration →](https://convex-better-auth.netlify.app/framework-guides/sveltekit)

---

## Why this adapter

- Svelte-friendly API for Convex Better Auth  
- Zero lock-in — your Convex, your data, your UI  
- Works standalone or with ready-to-ship components  
- Type-safe end-to-end integration via Convex  

---

## License

MIT
