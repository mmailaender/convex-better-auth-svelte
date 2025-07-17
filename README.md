1. run `pnpm i && pnpm dev`
2. Set environment variables

Generate a secret for encryption and generating hashes.
`npx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)`

Add TRUSTED_ORIGINS to convex as env variable and set the value to "http://localhost:5173" for your dev environment.
`npx convex env set TRUSTED_ORIGINS="http://localhost:5173"`