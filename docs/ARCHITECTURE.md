# Vector architecture

```mermaid
flowchart LR
  U[Founder enters URL] --> P[Startup profile\n(editable, confirmed)]
  P --> G[Candidate generation\n8 motions, ≤50]
  G --> T[Cheap triage\nhard exclusions first]
  T --> D[Deep research 12-15\nbounded adaptive loop]
  D --> V[Verify claims\nverbatim + entailment]
  V --> Q[Qualification gates ×9]
  Q --> R[Deterministic ranking\n100-pt rubric]
  R --> O[Targets ≤5 + Watchlist\n+ evidence + trace]
  O --> F[Founder feedback] --> R
```

## Two-pass funnel
Pass 1: multi-motion generation (≤50) → entity resolution → hard exclusions → cheap account
evidence → deterministic preliminary fit → retain 12-15. Pass 2: adaptive loop per candidate
(typed actions, ≤6 fast / ≤12 thorough), buyer discovery (named people for top 8 only),
claim verification, routes for finalists only, ranking, watchlist for credible-but-incomplete.

## Adaptive loop
State: evidence per dimension (fit, workflow, problem, severity, intent, timing, ownership,
alternative, buyer, person, entity confidence, conflicts, gaps). Policy: pick highest-value
unresolved gap → estimate marginal effect on qualification/rank → one typed action → validate +
store → update → stop on qualified / rejected / budget / insufficient evidence. Structured
summaries recorded (`DecisionTraceEntry`), shown in the UI.

## Evidence verification flow
Deterministic: verbatim excerpt ⊂ source text; source-id ∈ run; entity match; date compatible
with current-status; not a snippet; syndication dedup (content hash). Then entailment
(supports / partially / does-not / contradicts / unclear) via a narrow high-effort model call.
Fail → reject or weaken, one targeted repair, never silent upgrade.

## Data model (live: PostgreSQL + Drizzle; this build: typed in-memory + file persistence)
Key tables: startup_profiles, research_runs, research_stages(+versions/deps), research_actions,
companies(+aliases), people(+roles), sources, claims, claim_evidence (m:n, first-party here),
competitor_assessments, company_relationships, pain_signals(event_id dedup), candidate_accounts,
candidate_discovery_motions, candidate_feedback, decision_maker_assessments, public_routes,
lead_scores, provider_calls, research_exports, access_sessions (run ownership).

## Failure behaviour
Provider failure never destroys a run: completed stages persist, run marked partial, targeted
retries, upstream retry versions its output and invalidates dependents only. Live evidence is
never replaced with synthetic data.
