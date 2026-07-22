// End-to-end happy path over real HTTP (dependency-free — no browser package
// available in this sandbox; exercises the same routes the browser uses).
process.env.DEMO_TIME_SCALE = '0.001'; // fast-forward the demo clock

import assert from 'node:assert/strict';

async function main() {
  const { createServer } = await import('../../server/main');
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(3111, resolve));
  const base = 'http://localhost:3111';
  const checks: string[] = [];
  const pass = (name: string) => {
    checks.push(name);
    console.log(`  ✓ ${name}`);
  };

  try {
    // 1. Landing page
    let res = await fetch(`${base}/`);
    let text = await res.text();
    assert.equal(res.status, 200);
    assert.ok(text.includes('Find the account'));
    assert.ok(text.includes('Tramline'));
    pass('landing page renders with synthetic demo entry');

    // 2. Profile confirmation page (editable)
    res = await fetch(`${base}/analyse?demo=1`);
    text = await res.text();
    assert.ok(text.includes('Confirm company understanding'));
    assert.ok(text.includes('name="pf_name"'));
    assert.ok(text.includes('Synthetic demo data'));
    pass('startup profile is shown and editable');

    // 3. Confirm profile → creates run (with an edited field)
    const form = new URLSearchParams({ demo: '1', mode: 'fast', url: 'https://tramline.example', pf_name: 'Tramline' });
    res = await fetch(`${base}/runs/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      redirect: 'manual',
    });
    assert.equal(res.status, 303);
    const location = res.headers.get('location')!;
    const runId = location.split('/').pop()!;
    pass('confirming the profile starts a research run');

    // 4. Poll persisted run state
    res = await fetch(`${base}/api/runs/${runId}`);
    const view = (await res.json()) as { status: string; stages: unknown[] };
    assert.equal(res.status, 200);
    assert.equal(view.stages.length, 8);
    pass('run state polls from persisted stage state');

    // 5. Completed results page (time-scaled demo completes immediately)
    await new Promise((r) => setTimeout(r, 300));
    res = await fetch(`${base}${location}`);
    text = await res.text();
    assert.ok(text.includes('Halvard Logistics'), 'strongest target shown');
    assert.ok(text.includes('Why now'));
    assert.ok(text.includes('Tier 5'));
    assert.ok(text.includes('Qualification gates') || text.includes('qualification gates'));
    assert.ok(text.includes('Watchlist'));
    assert.ok(text.includes('Decision trace'));
    assert.ok(text.includes('Synthetic demo data'));
    pass('completed shortlist renders targets, evidence, gates and trace');

    // 6. Evidence integrity surfaces in the report
    assert.ok(text.includes('procurement.halvard-logistics.example'));
    assert.ok(text.includes('not double-counted') || text.includes('never double-counted'));
    pass('evidence and double-counting caveats visible');

    // 7. Founder feedback → rerank
    const apiView = (await (await fetch(`${base}/api/runs/${runId}`)).json()) as {
      results: { targets: { candidate: { id: string } }[] };
    };
    const firstId = apiView.results.targets[0]!.candidate.id;
    res = await fetch(`${base}/api/runs/${runId}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ candidateId: firstId, type: 'irrelevant', reason: 'e2e test' }),
    });
    const reranked = (await res.json()) as { results: { targets: { candidate: { id: string } }[]; rerankEvents: unknown[] } };
    assert.ok(!reranked.results.targets.some((t) => t.candidate.id === firstId));
    assert.equal(reranked.results.rerankEvents.length, 1);
    pass('marking a target irrelevant reranks without restarting');

    // 8. Exports
    res = await fetch(`${base}/api/runs/${runId}/export?format=targets`);
    const csv = await res.text();
    assert.equal(res.status, 200);
    assert.ok(csv.startsWith('rank,company,domain'));
    assert.ok(res.headers.get('content-disposition')?.includes('attachment'));
    res = await fetch(`${base}/api/runs/${runId}/export?format=report`);
    assert.equal(res.status, 200);
    pass('CSV and JSON exports download server-side');

    // 9. Failure path: live URL without credentials is refused honestly
    res = await fetch(`${base}/api/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://a-real-company.com' }),
    });
    assert.equal(res.status, 422);
    const err = (await res.json()) as { error: string };
    assert.equal(err.error, 'live_research_unavailable');
    pass('live mode never fabricates: real URLs refused without credentials');

    console.log(`\nE2E happy path: ${checks.length}/9 checks passed.`);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('E2E FAILED:', err);
  process.exit(1);
});
