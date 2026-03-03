---
trigger: always_on
---

# Code Rules

## General Guidelines

- Write clean, maintainable, and well-documented code
- Prioritize Great architecture, DX and UX.
- Stay consistent with the existing code.
- Use TypeScript for all new code
- Never use TypeScript type "any"
- validate your implementation with "pnpm check 2>&1", "timeout 30 npx convex dev --once 2>&1 || true" and "pnpm format && pnpm lint". Fix all errors and warnings related to your code.
