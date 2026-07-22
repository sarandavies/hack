import { createRun } from '@/lib/research/store';
import { buildRunView } from '@/lib/research/run-view';
import { demoProfile } from '@/data/demo/tramline';

const run = createRun({
  url: 'https://tramline.example',
  mode: 'fast',
  demo: true,
  profile: demoProfile,
  startedAt: '2026-07-22T10:00:00.000Z',
});
const view = buildRunView(run, Date.parse(run.createdAt) + 120_000);
for (const t of view.results!.targets) {
  console.log(`#${t.rank} ${t.candidate.name} — ${t.breakdown.total}/100 (signal ${t.breakdown.signal.total}/30, gates ${t.gates.passed ? 'PASS' : 'FAIL'})`);
}
for (const w of view.results!.watchlist) {
  console.log(`WATCHLIST ${w.candidate.name} — ${w.breakdown.total}/100`);
}
