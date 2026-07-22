# Vector

**Find the account. Know why now.**

Vector helps B2B startups identify their most promising prospective customers using **public
business information only**. Give it your company URL and it produces up to five ranked,
evidence-backed target accounts — each explaining why the account fits, why it may act now,
and who owns the problem — with every material claim inspectable down to a verbatim excerpt.

## Competition success definition

Given a real B2B startup URL, Vector aims to: surface a first evidence-backed preliminary
candidate within 90 seconds (Fast mode) and a final shortlist within five minutes; return
0–5 qualified accounts and **never pad to five**; give every target a fit hypothesis, a recent
commercially meaningful reason to act, and a buyer function (a named person only when publicly
verifiable); make every material claim inspectable; and **never invent** a company, person,
role, quotation, customer relationship or source. Quality targets (80%+ citation entailment,
zero fabrications, <25% qualified-target false positives) are evaluation objectives measured by
the eval harness — not claims displayed before measurement.

## Important build note (read first)

This repository was produced inside a sandbox whose **network egress blocks all package
registries** (npm, mirrors, pypi — verified at build time: `registry.npmjs.org` → 403
"Host not in allowlist"). Installing Next.js, Tailwind, Drizzle, Zod, Vitest or Playwright
was therefore impossible. Rather than ship an app that cannot run, Vector ships as a
**zero-external-dependency build** on the preinstalled toolchain:

- **Runtime/UI**: Node 22 `node:http` server with server-rendered HTML + a small vanilla JS
  polling client (`server/`, `public/`). Same routes, same polling model, same UX flow the
  spec describes.
- **Language**: strict TypeScript (tsc 6, `--noEmit` typecheck), executed via `tsx`.
- **Tests**: `node:test` (107 unit + integration assertions) plus an HTTP end-to-end happy path.
- **Validation**: hand-rolled env/request validation (`src/config/env.ts`, `server/main.ts`)
  standing in for Zod; provider interfaces accept any zod-compatible `{ parse }` schema.

The intelligence engine (`src/lib`, `src/config`, `src/data`) is framework-agnostic and ports
directly into the intended Next.js + Postgres + Drizzle + Vercel Workflow stack once registry
access exists. See *Known limitations*.

## Quick start

```bash
npm run dev          # http://localhost:3000  — no credentials needed
npm run verify       # typecheck + unit/integration tests + e2e happy path
```

Open the app → **Run the Tramline demo** → review/edit the inferred startup profile →
confirm → watch the eight research stages stream in (~65s, polling persisted state; survives
refresh) → inspect targets, evidence, gates, decision trace → mark a target irrelevant to see
reranking → export CSV/JSON/Markdown.

## What the demo demonstrates (all fictional, `.example` domains)

- **Tier 5 buying signal**: Halvard Logistics — open procurement RFP in category, named
  verified VP (via 2026 conference bio), shared-investor public route with explicit caveat.
- **Tier 4 forced action**: Meridian Grid — first-party outage postmortem, independent press
  corroboration, a claim *downgraded to partially-supported* ("regulator deadline" not evidenced).
- **Displacement mid-migration**: Bellcast — verified incumbent (Omnistack) dissatisfaction;
  qualifies **without** a named person (honest contactability limitation shown).
- **Conflict surfacing**: Corvid — stale 2024 bio vs June 2026 appointment (conflicting
  employment flagged), plus a **failed claim** rejected by verification and kept only as
  labelled speculation.
- **Honest negatives**: watchlist entries (fit-without-urgency; unresolved entity conflict),
  a hard-excluded existing customer, a disconfirmed search-snippet lead, and a tier-0 generic
  complaint that scores zero. Same underlying event never double-counted.

## Architecture

```
src/lib/types.ts               Domain model (claims ↔ evidence many-to-many, signals, candidates)
src/config/                    Scoring rubric constants, mode budgets, env validation
src/lib/scoring/               Signal tiers (5→0) + deterministic 100-point account scoring + 9 gates
src/lib/verification/          Verbatim-excerpt, snippet-rejection, staleness, syndication checks
src/lib/entity-resolution/     Canonical domains, name normalisation, employment currency
src/lib/security/ssrf.ts       URL validation + DNS-checked safeFetch (private ranges blocked)
src/lib/providers/             SearchProvider (Exa/Brave), extraction (safe fetch), LLM (Anthropic
                               REST, structured output w/ one repair attempt, per-stage effort)
src/lib/research/              Run store (persisted, refresh-safe) + deterministic run-view builder
src/lib/exports/               CSV (formula-injection safe), JSON report, Markdown brief
src/data/demo/tramline.ts      Self-verifying synthetic fixture (tests enforce evidence rules on it)
server/                        HTTP server + server-rendered UI
tests/                         unit, integration, e2e
```

Scoring: ICP 30 + commercial signal 30 + alternative/displacement 10 + buyer 10 + evidence
quality 10 + public route 5 + strategic 5 = 100. The model classifies enumerated inputs only;
every number comes from `src/config/scoring.ts`. Qualification gates are separate from ranking.

## Live mode

Live research requires `LIVE_RESEARCH_ENABLED=true`, `ANTHROPIC_API_KEY` (model default
`claude-sonnet-5`, configurable via `AI_MODEL`) and `EXA_API_KEY` or `BRAVE_SEARCH_API_KEY`.
Provider adapters are implemented and unit-covered; the end-to-end live orchestration loop is
**not yet wired** (see limitations). Without credentials the app refuses real URLs with an
honest error — it never fabricates a profile or mixes fixture data into a real company.
`npm run eval:live -- --url=...` reports honestly that no evaluation ran without credentials.

## Testing

```bash
npm run typecheck   # strict TS, noUncheckedIndexedAccess
npm test            # 107 assertions: every scoring branch, tier maths, no double-counting,
                    # verbatim/snippet/staleness/syndication checks, entity rules, SSRF,
                    # CSV escaping, fixture self-verification, run lifecycle + rerank
npm run test:e2e    # 9-step HTTP happy path incl. failure path (live refusal)
npm run verify      # all of the above
```

## Known limitations (honest)

- **No live end-to-end run has been executed** — the sandbox has no AI/search credentials and
  no registry egress. All quality-target numbers remain unmeasured.
- Live orchestrator (adaptive loop driving real providers), PostgreSQL/Drizzle persistence,
  Vercel Workflow adapter, second search provider wiring, and Playwright browser e2e are
  designed (interfaces + docs) but not implemented end to end in this build.
- Intended stack (Next.js App Router, Tailwind, shadcn/ui, Drizzle, Vitest, Playwright) could
  not be installed; the engine is stack-portable by design.
- Public-route research is conservative by design: an affinity is never an introduction.
- Run ownership is per-server-process; signed access sessions ship with the database layer.

## Public-data constraints

No LinkedIn scraping (public LinkedIn URLs may be kept only as unresolved leads, never
fetched or used to qualify claims), no login-protected access, no paywall/CAPTCHA bypass,
robots.txt respected, no private contact details, excerpts capped at 500 chars, search
snippets can never qualify a claim, and retrieved web content is always treated as hostile
data (delimited, never placed in system prompts, source-id allow-listing, SSRF-guarded fetch).
