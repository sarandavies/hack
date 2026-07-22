// Deterministic run-view builder. Progress is derived from elapsed time against a
// persisted start timestamp, so polling is idempotent, refresh-safe and needs no
// background timers or open connections. Results are recomputed from the fixture +
// the deterministic scoring engine + founder feedback on every read.

import type {
  Claim,
  PainSignal,
  RunResults,
  RunStageView,
  RunView,
  Source,
  TargetView,
  WatchlistView,
} from '../types';
import { BUDGETS } from '../../config/budgets';
import { getEnv } from '../../config/env';
import { SCORING_VERSION } from '../../config/scoring';
import { evaluateGates, scoreAccount } from '../scoring/score';
import { toSignalView } from '../scoring/signal-tiers';
import { claimCanQualify, verifiedEvidenceCount } from '../verification/verify';
import {
  demoCandidates,
  demoClaims,
  demoCompetitorCustomers,
  demoCompetitors,
  demoDecisionTrace,
  demoPreliminary,
  demoSignals,
  demoSources,
  demoTotals,
  demoUniverse,
} from '../../data/demo/tramline';
import type { RunRecord } from './store';

export const RUN_STAGES: { key: string; label: string; durationSeconds: number }[] = [
  { key: 'analyse', label: 'Understanding the startup', durationSeconds: 6 },
  { key: 'universe', label: 'Building the candidate universe', durationSeconds: 12 },
  { key: 'triage', label: 'Triaging candidate accounts', durationSeconds: 10 },
  { key: 'why_now', label: 'Investigating why now', durationSeconds: 12 },
  { key: 'buyers', label: 'Identifying buyers', durationSeconds: 8 },
  { key: 'verify', label: 'Verifying evidence', durationSeconds: 8 },
  { key: 'rank', label: 'Ranking targets', durationSeconds: 4 },
  { key: 'prepare', label: 'Preparing results', durationSeconds: 3 },
];

const TOTAL_SECONDS = RUN_STAGES.reduce((acc, s) => acc + s.durationSeconds, 0);

const sourcesById = new Map<string, Source>(demoSources.map((s) => [s.id, s]));

function candidateSignals(candidateId: string): PainSignal[] {
  return demoSignals.filter((s) => s.companyId === candidateId);
}

function candidateClaims(claimIds: string[]): Claim[] {
  return demoClaims.filter((c) => claimIds.includes(c.id));
}

function hasFirstPartyOrNamed(claims: Claim[]): boolean {
  return claims.some(
    (c) =>
      claimCanQualify(c) && (c.evidence.some((e) => e.firstParty) || c.type === 'named_person'),
  );
}

export function buildDemoResults(run: RunRecord): RunResults {
  const env = getEnv();
  const threshold = env.RESEARCH_QUALIFICATION_THRESHOLD;
  const excluded = new Set(
    run.feedback.filter((f) => f.type === 'irrelevant' || f.type === 'exclude').map((f) => f.candidateId),
  );
  const promising = new Set(
    run.feedback.filter((f) => f.type === 'promising').map((f) => f.candidateId),
  );

  const targets: TargetView[] = [];
  const watchlist: WatchlistView[] = [];

  for (const candidate of demoCandidates) {
    if (!candidate.classification) continue;
    const signals = candidateSignals(candidate.id);
    const claims = candidateClaims(candidate.claimIds);
    const breakdown = scoreAccount(candidate.classification, signals);
    const gates = evaluateGates({
      breakdown,
      signals,
      buyerFunctionIdentified: candidate.classification.buyerFunctionIdentified,
      verifiedEvidenceCount: verifiedEvidenceCount(claims, sourcesById),
      hasFirstPartyOrNamedEvidence: hasFirstPartyOrNamed(claims),
      hasCriticalEntityConflict: Boolean(candidate.hasCriticalEntityConflict),
      hasFailedMaterialClaim: claims.some((c) => c.material && c.verification === 'failed'),
      hardExcluded: Boolean(candidate.hardExclusion),
      threshold,
    });
    const signalViews = signals
      .map(toSignalView)
      .sort((a, b) => b.score - a.score);

    if (candidate.status === 'qualified' && gates.passed && !excluded.has(candidate.id)) {
      targets.push({
        candidate,
        breakdown,
        gates,
        rank: 0,
        signals: signalViews,
        claims,
        promising: promising.has(candidate.id),
      });
    } else if (candidate.status === 'watchlist' || (candidate.status === 'qualified' && !gates.passed)) {
      watchlist.push({
        candidate,
        breakdown,
        gates,
        reason: candidate.watchlistReason ?? 'Did not pass all qualification gates.',
      });
    }
  }

  targets.sort((a, b) => b.breakdown.total - a.breakdown.total);
  targets.forEach((t, i) => (t.rank = i + 1));

  const rerankEvents = run.feedback
    .filter((f) => f.type === 'irrelevant' || f.type === 'exclude')
    .map((f) => {
      const name = demoCandidates.find((c) => c.id === f.candidateId)?.name ?? f.candidateId;
      return {
        reason: `${name} ${f.type === 'irrelevant' ? 'marked irrelevant' : 'excluded'} by founder${f.reason ? `: ${f.reason}` : ''}. Remaining targets reranked; verified evidence preserved.`,
        at: f.createdAt,
      };
    });

  return {
    targets: targets.slice(0, 5),
    watchlist,
    universe: demoUniverse,
    competitors: demoCompetitors,
    competitorCustomers: demoCompetitorCustomers,
    signals: demoSignals.map(toSignalView),
    decisionTrace: demoDecisionTrace,
    sources: demoSources,
    rerankEvents,
  };
}

export function buildRunView(run: RunRecord, nowMs: number = Date.now()): RunView {
  const env = getEnv();
  const scale = env.DEMO_TIME_SCALE > 0 ? env.DEMO_TIME_SCALE : 1;
  const elapsedSeconds = Math.max(0, (nowMs - Date.parse(run.createdAt)) / 1000) / scale;
  const budget = BUDGETS[run.mode];

  const stages: RunStageView[] = [];
  let cumulative = 0;
  for (const stage of RUN_STAGES) {
    const start = cumulative;
    cumulative += stage.durationSeconds;
    const status =
      elapsedSeconds >= cumulative ? 'completed' : elapsedSeconds >= start ? 'running' : 'pending';
    stages.push({ key: stage.key, label: stage.label, status });
  }
  const completed = elapsedSeconds >= TOTAL_SECONDS;
  const fraction = Math.min(1, elapsedSeconds / TOTAL_SECONDS);

  const preliminary = demoPreliminary
    .filter((p) => elapsedSeconds >= p.appearAtSeconds)
    .map((p) => {
      const c = demoCandidates.find((cand) => cand.id === p.candidateId);
      return {
        candidateId: p.candidateId,
        name: c?.name ?? p.candidateId,
        domain: c?.domain ?? '',
        motion: c?.motionPrimary ?? ('trigger' as const),
        hypothesis: c?.fitHypothesis ?? '',
        evidenceNote: p.evidenceNote,
        sourceUrl: p.sourceUrl,
      };
    });

  return {
    id: run.id,
    url: run.url,
    mode: run.mode,
    demo: run.demo,
    status: completed ? 'completed' : 'running',
    startedAt: run.createdAt,
    retrievedAt: '2026-07-20T09:14:00Z',
    stages,
    metrics: {
      sourcesReviewed: Math.round(demoTotals.sourcesReviewed * fraction),
      companiesConsidered: Math.round(demoTotals.companiesConsidered * Math.min(1, fraction * 1.8)),
      queriesUsed: Math.round(demoTotals.queriesUsed * fraction),
    },
    budget: {
      searchQueries: { used: Math.round(demoTotals.queriesUsed * fraction), limit: budget.maxSearchQueries },
      pagesFetched: { used: Math.round(demoTotals.pagesFetched * fraction), limit: budget.maxFetchedPages },
      estCostUsd: { used: 0, limit: budget.defaultMaxCostUsd },
      elapsedSeconds: { used: Math.round(elapsedSeconds), limit: budget.maxWallClockSeconds },
    },
    preliminaryCandidates: preliminary,
    results: completed ? buildDemoResults(run) : undefined,
    profile: run.profile,
    feedback: run.feedback,
    scoringVersion: SCORING_VERSION,
  };
}
