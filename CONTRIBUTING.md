# Contributing to convex-better-auth-svelte

Thank you for your interest in contributing! This guide will help you get set up for development and testing.

## Prerequisites

- Node.js 22+
- pnpm
- A Convex account (free tier works)

## Development Setup

### 1. Clone and Install

```bash
git clone https://github.com/mmailaender/convex-better-auth-svelte.git
cd convex-better-auth-svelte
pnpm install
```

### 2. Set Up Convex

Create a new Convex project or use an existing one:

```bash
npx convex dev
```

This will prompt you to create a new project or link to an existing one.

### 3. Run Development Server

```bash
pnpm run dev
```

This starts both the Vite dev server and Convex in watch mode.

## Running Tests

### Unit Tests

```bash
pnpm run test:unit
```

### E2E Tests

E2E tests require a test user in your Convex database.

#### 1. Create Test User

Make sure your dev server is running, then:

```bash
pnpm run setup:test-user
```

This creates a user with the credentials from `.env.test` in your Convex database.

#### 2. Install Playwright Browsers

First time only:

```bash
pnpm exec playwright install
```

#### 3. Run E2E Tests

```bash
pnpm run test:e2e
```

Or run with UI:

```bash
pnpm run test:e2e:ui
```

## Test Scenarios

The E2E tests cover these authentication scenarios:

| Scenario | Description |
|----------|-------------|
| SSR Authenticated | User is authenticated via SSR, sees content immediately |
| SSR → Sign Out | Authenticated user signs out |
| Client-only Auth | User signs in without SSR state |
| Protected Queries | Queries that require authentication |

## Project Structure

```
├── src/
│   ├── lib/
│   │   ├── svelte/           # Client-side auth integration
│   │   │   ├── client.svelte.ts
│   │   │   └── index.ts
│   │   └── sveltekit/        # Server-side helpers
│   │       └── index.ts
│   └── routes/
│       ├── +layout.svelte    # Root layout (CSS, nav)
│       ├── +page.svelte      # Landing page
│       ├── dev/              # Development playground
│       │   ├── +layout.svelte
│       │   └── +page.svelte  # Full auth demo
│       └── test/             # E2E test routes
│           ├── ssr/          # SSR auth tests
│           ├── client-only/  # Client-only auth tests
│           └── queries/      # Query behavior tests
├── e2e/                      # E2E tests (Playwright)
├── scripts/                  # Development scripts
└── convex/                   # Convex backend
```

### Route Overview

| Route | Purpose |
|-------|---------|
| `/` | Landing page with links |
| `/dev` | Development playground with full auth demo |
| `/test/ssr` | SSR authentication test page |
| `/test/client-only` | Client-only authentication test page |
| `/test/queries` | Public/protected query behavior test page |

## Code Style

- We use Prettier for formatting
- Run `pnpm run format` before committing
- Run `pnpm run lint` to check for issues

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`pnpm test:e2e`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Questions?

Feel free to open an issue if you have questions or run into problems!
