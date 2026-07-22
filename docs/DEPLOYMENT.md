# Deployment

This build runs anywhere with Node 22: `npm run dev` (no build step, no secrets for demo).

Zero-dep specifics: global `tsx` + `typescript` and a local `node_modules/@types/node`
symlink/install are the only requirements (see .github/workflows/ci.yml).

Intended production path once registry egress exists: port UI to Next.js App Router (the
engine in src/ is unchanged), add Drizzle + Neon Postgres (DATABASE_URL), Vercel Workflow for
durable orchestration, then:
  1. git remote add origin <repo> && git push -u origin main
  2. vercel link && vercel env add (vars from .env.example) && vercel deploy --prod
Environment variables are documented in .env.example. Never commit .env.
