import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addFeedback, createRun } from '@/lib/research/store';
import { buildRunView } from '@/lib/research/run-view';
import { demoProfile } from '@/data/demo/tramline';

function newRun() {
  return createRun({
    url: 'https://tramline.example',
    mode: 'fast',
    demo: true,
    profile: demoProfile,
    startedAt: '2026-07-22T10:00:00.000Z',
  });
}
const T0 = Date.parse('2026-07-22T10:00:00.000Z');

describe('demo run lifecycle', () => {
  it('starts with pending/running stages and no results', () => {
    const view = buildRunView(newRun(), T0 + 1000);
    assert.equal(view.status, 'running');
    assert.equal(view.results, undefined);
    assert.equal(view.stages[0]?.status, 'running');
    assert.equal(view.stages.at(-1)?.status, 'pending');
  });
  it('surfaces the first evidence-backed preliminary candidate well inside the 90s target', () => {
    const view = buildRunView(newRun(), T0 + 25_000);
    assert.equal(view.status, 'running');
    assert.ok(view.preliminaryCandidates.length >= 1);
    assert.equal(view.preliminaryCandidates[0]?.name, 'Halvard Logistics');
    assert.ok(view.preliminaryCandidates[0]?.sourceUrl.includes('.example'));
  });
  it('completes with ranked targets, watchlist and full results', () => {
    const view = buildRunView(newRun(), T0 + 120_000);
    assert.equal(view.status, 'completed');
    const r = view.results;
    assert.ok(r);
    assert.ok(r.targets.length > 0 && r.targets.length <= 5, 'between 1 and 5 targets');
    // Ranked strictly by descending deterministic score
    for (let i = 1; i < r.targets.length; i++) {
      assert.ok(r.targets[i - 1]!.breakdown.total >= r.targets[i]!.breakdown.total);
      assert.equal(r.targets[i]!.rank, i + 1);
    }
    // Every target passed all gates
    for (const t of r.targets) {
      assert.equal(t.gates.passed, true, `${t.candidate.name} gates`);
      assert.ok(t.breakdown.total >= 70);
      assert.ok(t.signals.length > 0);
    }
    // Watchlist entries failed at least one gate and carry a reason
    for (const w of r.watchlist) {
      assert.equal(w.gates.passed, false);
      assert.ok(w.reason.length > 10);
    }
    // Excluded existing customer never appears in targets
    assert.ok(!r.targets.some((t) => t.candidate.id === 'cand_qg'));
  });
  it('is deterministic: identical reads produce identical results', () => {
    const run = newRun();
    const a = JSON.stringify(buildRunView(run, T0 + 120_000).results);
    const b = JSON.stringify(buildRunView(run, T0 + 120_000).results);
    assert.equal(a, b);
  });
  it('founder feedback reranks without restarting and preserves verified evidence', () => {
    const run = newRun();
    const before = buildRunView(run, T0 + 120_000);
    const firstId = before.results!.targets[0]!.candidate.id;
    const beforeCount = before.results!.targets.length;
    addFeedback(run.id, firstId, 'irrelevant', 'not a fit');
    const after = buildRunView(run, T0 + 120_000);
    assert.equal(after.results!.targets.length, beforeCount - 1);
    assert.ok(!after.results!.targets.some((t) => t.candidate.id === firstId));
    assert.equal(after.results!.targets[0]?.rank, 1);
    assert.equal(after.results!.rerankEvents.length, 1);
    // Evidence for remaining targets untouched
    assert.ok(after.results!.targets.every((t) => t.claims.length > 0 || t.candidate.claimIds.length === 0));
  });
  it('marking promising flags the target without changing deterministic order', () => {
    const run = newRun();
    const before = buildRunView(run, T0 + 120_000);
    const secondId = before.results!.targets[1]!.candidate.id;
    addFeedback(run.id, secondId, 'promising');
    const after = buildRunView(run, T0 + 120_000);
    const flagged = after.results!.targets.find((t) => t.candidate.id === secondId);
    assert.equal(flagged?.promising, true);
    assert.deepEqual(
      after.results!.targets.map((t) => t.candidate.id),
      before.results!.targets.map((t) => t.candidate.id),
    );
  });
  it('budget usage never exceeds fast-mode limits during the run', () => {
    for (const offset of [10_000, 30_000, 60_000, 120_000]) {
      const view = buildRunView(newRun(), T0 + offset);
      assert.ok(view.budget.searchQueries.used <= view.budget.searchQueries.limit);
      assert.ok(view.budget.pagesFetched.used <= view.budget.pagesFetched.limit);
      assert.ok(view.budget.estCostUsd.used <= view.budget.estCostUsd.limit);
    }
  });
});
