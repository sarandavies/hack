// Server-side HTML rendering (dependency-free). All dynamic values pass through esc().
import type {
  Claim,
  RunView,
  Source,
  StartupProfile,
  TargetView,
  WatchlistView,
} from '../src/lib/types.js';

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TIER_LABELS: Record<number, string> = {
  5: 'Tier 5 · Active buying',
  4: 'Tier 4 · Forced action',
  3: 'Tier 3 · Committed change',
  2: 'Tier 2 · Explicit pain',
  1: 'Tier 1 · Structural',
  0: 'Tier 0 · Non-signal',
};
function tierBadge(tier: number): string {
  const tone = tier >= 5 ? 'ink' : tier === 4 ? 'red' : tier === 3 ? 'teal' : tier === 2 ? 'amber' : '';
  return `<span class="badge ${tone}">${TIER_LABELS[tier] ?? tier}</span>`;
}
function verBadge(status: string): string {
  if (status === 'verified') return '<span class="badge teal">Verified</span>';
  if (status === 'partially_verified') return '<span class="badge amber">Partially supported</span>';
  if (status === 'failed') return '<span class="badge red">Failed verification</span>';
  return '<span class="badge">Unverified</span>';
}
const demoBanner = `<div class="banner-demo"><strong>Synthetic demo data.</strong> Every company, person, URL and quotation in this run is fictional, on reserved .example domains. Live runs use retrieved public information only.</div>`;

export function layout(
  title: string,
  body: string,
  opts: { status?: string; runId?: string } = {},
): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/public/styles.css">
</head>
<body${opts.status ? ` data-status="${esc(opts.status)}"` : ''}${opts.runId ? ` data-run="${esc(opts.runId)}"` : ''}>
<header class="site"><div class="wrap">
  <a class="brand" href="/">Vector<span class="tag">Find the account. Know why now.</span></a>
  <nav><a href="/methodology">Methodology</a></nav>
</div></header>
<main><div class="wrap">${body}</div></main>
<footer class="site">Vector uses public business information only. It never scrapes login-protected services, never generates private contact details, and every material claim is inspectable.</footer>
<script src="/public/app.js" defer></script>
</body></html>`;
}

// ---------------------------------------------------------------------------
export function landingPage(): string {
  const steps = [
    ['Understand the startup', 'Vector reads your public site like a technically informed CTO: which workflow you change, what must be true inside a customer, and which external signals reveal the problem.'],
    ['Discover candidates eight ways', 'Competitor displacement, live triggers, use-case evidence, lookalikes, technographics, change events, procurement intent and ecosystems — then a cheap triage over up to 50 accounts.'],
    ['Prove why now', 'Signals are ranked commercially: an open RFP outranks an angry tweet. Every claim is checked for verbatim excerpts and entailment before it can qualify an account.'],
    ['Rank and explain', 'Up to five accounts pass deterministic qualification gates — never padded to five. Each shows why it fits, why now, who owns the problem and exactly what evidence proves it.'],
  ];
  return layout('Vector — Find the account. Know why now.', `
<section style="max-width:46rem">
  <h1>Find the account. <span style="color:var(--teal)">Know why now.</span></h1>
  <p class="muted">Vector identifies your most promising prospective customers from public business information: procurement notices, postmortems, engineering blogs, job adverts, filings and conference talks. No scraping of login-protected services, no invented contacts, every claim inspectable.</p>
</section>
<section class="card pad mt2">
  <form method="GET" action="/analyse">
    <label class="label" for="url">Your company website</label>
    <div class="row mt1" style="flex-wrap:nowrap">
      <input id="url" name="url" class="field" placeholder="https://yourstartup.com" required>
      <button class="btn-primary" type="submit" style="white-space:nowrap">Find target customers</button>
    </div>
    <div class="row mt1 small muted">
      <span class="label">Research mode</span>
      <label><input type="radio" name="mode" value="fast" checked> Fast (~5 min, live demo)</label>
      <label><input type="radio" name="mode" value="thorough"> Thorough (~15 min, deeper)</label>
    </div>
    <details class="mt1"><summary>Advanced criteria</summary>
      <div class="grid2 mt1">
        ${[
          ['geos', 'Target geographies', 'UK, EU, North America'],
          ['sizes', 'Preferred company-size range', '200-5,000 employees'],
          ['industries', 'Target industries', 'Logistics, energy, payments'],
          ['excludeCustomers', 'Existing customers to exclude', 'Comma-separated'],
          ['excludeCompanies', 'Companies to exclude', 'Comma-separated'],
          ['competitors', 'Known competitors', 'Comma-separated'],
          ['strongCustomers', 'Known strong customers or design partners', 'Comma-separated'],
          ['context', 'Additional product context', 'Anything Vector should know'],
        ].map(([n, l, p]) => `<div><label class="label">${l}</label><input class="field mt1" name="${n}" placeholder="${p}"></div>`).join('')}
      </div>
    </details>
  </form>
</section>
<section class="card pad mt2" style="border-color:#d9c9a3">
  <div class="row between">
    <div style="max-width:44rem">
      <div class="row"><h2 style="margin:0">Try the synthetic demo: Tramline</h2><span class="badge amber">SYNTHETIC DATA</span></div>
      <p class="small muted">A fictional streaming-pipeline reliability startup, researched end to end: an open RFP, a public outage postmortem, an in-flight migration, a rejected search lead, a surfaced employment conflict and a watchlist. All companies are fictional, on reserved .example domains. Runs with no credentials.</p>
    </div>
    <a class="btn-primary" href="/analyse?demo=1">Run the Tramline demo</a>
  </div>
</section>
<section class="grid2 mt3">
  ${steps.map(([t, b], i) => `<div class="card pad"><div class="label">Step ${i + 1}</div><h3>${t}</h3><p class="small muted">${b}</p></div>`).join('')}
</section>
<section class="mt3 tiny muted" style="max-width:46rem"><p><strong>Public business information only.</strong> Vector reads public websites, documentation, case studies, press, job adverts, procurement notices, filings, registries, incident reports, conference pages and public forums. It never scrapes LinkedIn, bypasses paywalls or CAPTCHAs, ignores robots.txt, or generates private contact details. Search snippets create leads — they are never treated as evidence.</p></section>
`);
}

// ---------------------------------------------------------------------------
const FIELD_LABELS: Record<string, string> = {
  name: 'Company name', domain: 'Canonical domain', oneLiner: 'One-sentence product description',
  description: 'Detailed product description', category: 'Product category', coreProblem: 'Core problem solved',
  primaryUseCases: 'Primary use cases', secondaryUseCases: 'Secondary use cases', primaryUsers: 'Primary users',
  economicBuyers: 'Economic buyers', functionalOwners: 'Functional owners', technicalEvaluators: 'Technical evaluators',
  workflows: 'Relevant company workflows', targetIndustries: 'Target industries', targetSizes: 'Target company sizes',
  targetGeographies: 'Target geographies', requiredTechnicalConditions: 'Required technical conditions',
  incompatibleConditions: 'Incompatible technical conditions', currentAlternatives: 'Current alternatives',
  knownCompetitors: 'Known competitors', existingCustomers: 'Existing customers', technicalVocabulary: 'Technical vocabulary',
  buyerVocabulary: 'Buyer vocabulary', painVocabulary: 'Pain vocabulary', procurementVocabulary: 'Procurement vocabulary',
  observableSignals: 'Observable external signals', exclusionCriteria: 'Exclusion criteria',
  confidence: 'Confidence', evidenceRefs: 'Evidence references',
};

export function analysePage(profile: StartupProfile | null, opts: { demo: boolean; mode: string; url: string; error?: string }): string {
  let inner: string;
  if (opts.error || !profile) {
    inner = `<div class="card pad"><h2 style="color:var(--red)">Cannot analyse this company</h2><p class="small muted" style="max-width:38rem">${esc(opts.error ?? 'Unknown error')}</p></div>
    <p class="mt1"><a href="/analyse?demo=1"><strong>Run the synthetic Tramline demo instead →</strong></a></p>`;
  } else {
    const fields = Object.entries(profile).map(([key, value]) => {
      const isArray = Array.isArray(value);
      const label = FIELD_LABELS[key] ?? key;
      const raw = isArray ? (value as string[]).join('\n') : String(value);
      const long = key === 'description' || isArray;
      const span = key === 'description' ? ' style="grid-column:1/-1"' : '';
      const control = long
        ? `<textarea class="field mt1" name="pf_${esc(key)}" rows="${key === 'description' ? 4 : Math.min(6, Math.max(2, raw.split('\n').length))}">${esc(raw)}</textarea>`
        : `<input class="field mt1" name="pf_${esc(key)}" value="${esc(raw)}">`;
      return `<div${span}><label class="label">${esc(label)}${isArray ? ' <span style="text-transform:none;letter-spacing:0;font-weight:400">(one per line)</span>' : ''}</label>${control}</div>`;
    }).join('');
    inner = `<form method="POST" action="/runs/create">
      <input type="hidden" name="mode" value="${esc(opts.mode)}">
      <input type="hidden" name="demo" value="${opts.demo ? '1' : '0'}">
      <input type="hidden" name="url" value="${esc(opts.url)}">
      <div class="grid2">${fields}</div>
      <div class="row mt2"><button class="btn-primary" type="submit">Confirm profile &amp; start research</button>
      <span class="small muted">Full research begins only after you confirm. Every field above is editable.</span></div>
    </form>`;
  }
  return layout('Confirm company understanding — Vector', `
${opts.demo ? demoBanner : ''}
<h1 style="font-size:1.6rem">Confirm company understanding</h1>
<p class="small muted" style="max-width:42rem">Vector inferred this profile from public pages on ${esc(opts.url)}. Correct anything that looks wrong — the profile drives candidate discovery, search planning and qualification.</p>
<div class="mt2">${inner}</div>`);
}

// ---------------------------------------------------------------------------
function claimHtml(claim: Claim, sources: Map<string, Source>): string {
  const evidence = claim.evidence.map((ev) => {
    const src = sources.get(ev.sourceId);
    const entTone = ev.entailment === 'supports' ? 'teal' : ev.entailment === 'partially_supports' ? 'amber' : 'red';
    return `<div class="mt1">
      <blockquote class="excerpt">“${esc(ev.excerpt)}”</blockquote>
      <div class="row tiny muted">
        ${src ? `<a href="${esc(src.url)}" rel="noopener noreferrer nofollow">${esc(src.title)}</a><span>${esc(src.domain)}</span>${src.publishedAt ? `<span>published ${esc(src.publishedAt)}</span>` : ''}<span>retrieved ${esc(src.retrievedAt.slice(0, 10))}</span>` : `<span>Unknown source ${esc(ev.sourceId)}</span>`}
        <span class="badge ${ev.firstParty ? 'teal' : ''}">${ev.firstParty ? 'First-party for this claim' : 'Third-party'}</span>
        <span class="badge ${entTone}">${esc(ev.entailment.replace(/_/g, ' '))}</span>
      </div>
      <p class="tiny muted">${esc(ev.relationship)}</p>
    </div>`;
  }).join('');
  return `<div class="mt1" style="border-top:1px solid var(--border);padding-top:0.5rem">
    <div class="row small">${verBadge(claim.verification)}<span class="badge">${esc(claim.classification.replace(/_/g, ' '))}</span><strong>${esc(claim.text)}</strong></div>
    ${claim.conflict ? `<p class="tiny" style="color:var(--amber)">⚠ ${esc(claim.conflict)}</p>` : ''}
    ${evidence}</div>`;
}

function targetCardHtml(t: TargetView, sources: Map<string, Source>): string {
  const c = t.candidate;
  const strongest = t.signals[0];
  const supporting = t.signals.slice(1);
  const verified = t.claims.filter((cl) => cl.verification === 'verified');
  const partial = t.claims.filter((cl) => cl.verification === 'partially_verified');
  const failed = t.claims.filter((cl) => cl.verification === 'failed');
  const b = t.breakdown;
  const scoreRows: [string, number, number][] = [
    ['ICP fit', b.icp.total, 30], ['Commercial signal', b.signal.total, 30],
    ['Alternative & displacement', b.alternative.total, 10], ['Buyer & contactability', b.buyer.total, 10],
    ['Evidence quality', b.evidenceQuality.total, 10], ['Public route', b.route, 5], ['Strategic accessibility', b.strategic.total, 5],
  ];

  return `<article class="card pad mt2">
  <header class="row between">
    <div style="max-width:46rem">
      <div class="row"><span class="rank">${t.rank}</span><h3 style="margin:0">${esc(c.name)}</h3><span class="small muted">${esc(c.domain)}</span>${t.promising ? '<span class="badge teal">Marked promising</span>' : ''}</div>
      <p class="small muted">${esc(c.description)}</p>
      <div class="row tiny muted"><span>${esc(c.industry)}</span><span>${esc(c.geography)}</span><span>${esc(c.sizeEstimate)}</span><span>Unit: ${esc(c.businessUnit)}</span><span class="badge">found via ${esc(c.motionPrimary.replace(/_/g, ' '))}</span></div>
    </div>
    <div style="text-align:right"><div class="score-big">${b.total}</div><div class="tiny muted">/ 100 · qualified</div></div>
  </header>
  ${strongest ? `<section class="whynow mt2">
    <div class="row"><span class="label">Why now</span>${tierBadge(strongest.tier)}<span class="tiny" style="font-family:ui-monospace,monospace">${strongest.score}/30</span><span class="tiny muted">event ${esc(strongest.publishedAt)} · evidence retrieved ${esc(strongest.retrievedAt.slice(0, 10))}</span></div>
    <p class="mt1" style="font-weight:600">${esc(strongest.eventDescription)}</p>
    <blockquote class="excerpt">“${esc(strongest.excerpt)}”</blockquote>
    <p class="small muted">${esc(c.whyNow?.commercialImplication ?? '')}</p>
    ${c.whyNow?.signalOwner ? `<p class="tiny muted">Signal owner: ${esc(c.whyNow.signalOwner)}</p>` : ''}
    ${supporting.length ? `<div class="tiny muted mt1" style="border-top:1px solid var(--border);padding-top:0.4rem">Supporting signals: ${supporting.map((s) => `${tierBadge(s.tier)} ${esc(s.eventDescription)}${strongest && s.eventId === strongest.eventId ? ' <em>(same underlying event — not double-counted)</em>' : ''}`).join(' · ')}</div>` : ''}
  </section>` : ''}
  <section class="grid2 mt2">
    <div><div class="label">Why this fits</div>
      <ul class="small">
        <li>${esc(c.whyFits?.icpMatch ?? '')}</li>
        <li><strong>Use case:</strong> ${esc(c.whyFits?.useCase ?? '')}</li>
        <li><strong>Technical fit:</strong> ${esc(c.whyFits?.technicalFit ?? '')}</li>
        ${c.whyFits?.currentAlternative ? `<li><strong>Current alternative:</strong> ${esc(c.whyFits.currentAlternative)}</li>` : ''}
        <li><strong>Affected workflow:</strong> ${esc(c.whyFits?.affectedWorkflow ?? '')}</li>
      </ul></div>
    <div><div class="label">Who to contact</div>
      ${c.buyerFunction ? `<p class="small"><strong>Buyer function:</strong> ${esc(c.buyerFunction)}</p>` : ''}
      ${c.people.length === 0 ? `<p class="small muted">${esc(c.buyerFunctionNote ?? 'Buyer function identified; no named current person publicly verifiable.')}</p>` : ''}
      <ul class="small" style="list-style:none;padding:0">
      ${c.people.map((p) => `<li class="mt1">
        <div class="row"><strong>${esc(p.name)}</strong><span class="muted">${esc(p.title)}</span>
        <span class="badge ${p.employmentStatus === 'current_verified' ? 'teal' : p.employmentStatus === 'conflicting' ? 'red' : 'amber'}">${esc(p.employmentStatus.replace(/_/g, ' '))}</span>
        <span class="badge">${esc(p.buyingRole.replace(/_/g, ' '))}</span><span class="badge">${esc(p.confidence)} confidence</span></div>
        <p class="tiny muted">${esc(p.why)} <a href="${esc(p.sourceUrl)}" rel="noopener noreferrer nofollow">${esc(p.sourceTitle)}</a> (${esc(p.evidenceDate)})</p>
        ${p.conflictNote ? `<p class="tiny" style="color:var(--red)">⚠ ${esc(p.conflictNote)}</p>` : ''}
      </li>`).join('')}
      </ul></div>
  </section>
  ${c.approach ? `<section class="subpanel mt2 small">
    <div class="label">Suggested approach</div>
    <p><strong>Angle:</strong> ${esc(c.approach.angle)}</p>
    <p><strong>Opening question:</strong> ${esc(c.approach.openingQuestion)}</p>
    <p><strong>Reason to approach now:</strong> ${esc(c.approach.reasonNow)}</p>
    <p style="color:var(--amber)"><strong>Main uncertainty to validate:</strong> ${esc(c.approach.uncertainty)}</p>
    ${c.approach.connector ? `<p class="muted"><strong>Public connector or affinity:</strong> ${esc(c.approach.connector)}</p>` : ''}
  </section>` : ''}
  <details><summary>Evidence (${verified.length} verified claim${verified.length === 1 ? '' : 's'}${partial.length ? `, ${partial.length} partial` : ''})</summary>
    ${verified.map((cl) => claimHtml(cl, sources)).join('')}
    ${partial.length ? `<div class="mt2"><div class="label">Partially supported — shown with caveats, not used for qualification</div>${partial.map((cl) => claimHtml(cl, sources)).join('')}</div>` : ''}
    ${failed.length ? `<div class="mt2"><div class="label">Rejected by verification — never shown as fact</div>${failed.map((cl) => claimHtml(cl, sources)).join('')}</div>` : ''}
    ${c.researchNotes?.length ? `<div class="subpanel dashed mt2 tiny muted"><div class="label">Research notes (labelled speculation — does not affect qualification)</div>${c.researchNotes.map((n) => `<p>${esc(n)}</p>`).join('')}</div>` : ''}
  </details>
  <details><summary>Score breakdown &amp; qualification gates</summary>
    <table class="vt mt1" style="max-width:26rem"><tbody>
      ${scoreRows.map(([l, v, m]) => `<tr><td>${l}</td><td class="num">${v}/${m}</td></tr>`).join('')}
      <tr><td><strong>Total (${esc(b.version)})</strong></td><td class="num"><strong>${b.total}/100</strong></td></tr>
    </tbody></table>
    <p class="tiny muted mt1">Signal detail: primary event ${b.signal.primaryScore}/30 + corroboration bonus ${b.signal.corroborationBonus} (one independent event max; syndicated coverage never double-counted).</p>
    <div class="label mt1">Qualification gates</div>
    <ul class="small" style="list-style:none;padding:0">${t.gates.gates.map((g) => `<li><span class="${g.passed ? 'gatepass' : 'gatefail'}">${g.passed ? '✓' : '✗'}</span> ${esc(g.label)} <span class="muted">— ${esc(g.detail)}</span></li>`).join('')}</ul>
  </details>
  <footer class="row mt2">
    <button class="btn-quiet" data-feedback="promising" data-candidate="${esc(c.id)}">Mark promising</button>
    <button class="btn-quiet" data-feedback="irrelevant" data-candidate="${esc(c.id)}" data-reason="Founder marked irrelevant">Mark irrelevant</button>
    <button class="btn-quiet" data-feedback="deeper_research" data-candidate="${esc(c.id)}">Request deeper research</button>
  </footer>
</article>`;
}

function watchlistCardHtml(w: WatchlistView): string {
  const c = w.candidate;
  const failing = w.gates.gates.filter((g) => !g.passed);
  return `<article class="card pad mt2">
    <div class="row"><h3 style="margin:0">${esc(c.name)}</h3><span class="small muted">${esc(c.domain)}</span><span class="badge amber">Watchlist</span><span class="tiny muted">${w.breakdown.total}/100</span></div>
    <p class="small muted">${esc(c.description)}</p>
    <p class="small"><strong>Why not (yet) a target:</strong> ${esc(w.reason)}</p>
    ${failing.length ? `<p class="tiny muted">Failing gates: ${failing.map((g) => esc(g.label)).join(' · ')}</p>` : ''}
    ${c.conflicts.length ? `<p class="tiny" style="color:var(--red)">⚠ ${c.conflicts.map(esc).join(' ')}</p>` : ''}
  </article>`;
}

export function runPage(view: RunView): string {
  const sources = new Map(view.results?.sources.map((s) => [s.id, s]) ?? []);
  const running = view.status === 'running';

  const stagesHtml = `<ol class="stages">${view.stages.map((s) => `<li class="stage ${s.status}" data-stage="${esc(s.key)}"><span class="dot"></span><span>${esc(s.label)}</span></li>`).join('')}</ol>`;
  const budgetHtml = `<div class="card pad">
    <div class="row between"><span class="label">Budget · ${esc(view.mode)} mode</span><span class="tiny muted"><span id="m-sources">${view.metrics.sourcesReviewed}</span> sources · <span id="m-companies">${view.metrics.companiesConsidered}</span> companies</span></div>
    <table class="vt mt1"><tbody>
      <tr><td>Search queries</td><td class="num" id="m-queries">${view.budget.searchQueries.used} / ${view.budget.searchQueries.limit}</td></tr>
      <tr><td>Pages fetched</td><td class="num" id="m-pages">${view.budget.pagesFetched.used} / ${view.budget.pagesFetched.limit}</td></tr>
      <tr><td>Elapsed</td><td class="num" id="m-elapsed">${view.budget.elapsedSeconds.used}s / ${view.budget.elapsedSeconds.limit}s</td></tr>
      <tr><td>Estimated cost (USD)</td><td class="num">${view.budget.estCostUsd.used.toFixed(2)} / ${view.budget.estCostUsd.limit.toFixed(2)}${view.demo ? ' (synthetic)' : ''}</td></tr>
    </tbody></table>
    <p class="tiny muted mt1">Evidence retrieved ${esc(view.retrievedAt.slice(0, 10))} · scoring ${esc(view.scoringVersion)}</p>
  </div>`;

  if (running) {
    return layout(`Researching ${view.profile.name} — Vector`, `
${view.demo ? demoBanner : ''}
<h1 style="font-size:1.6rem">Researching ${esc(view.profile.name)}</h1>
<p class="small muted">${esc(view.profile.oneLiner)}</p>
<div class="grid3 mt2">
  <div>
    <div class="card pad">${stagesHtml}</div>
    <div class="mt2"><div class="label">Preliminary candidates</div><div id="prelim">
      ${view.preliminaryCandidates.map((p) => `<div class="card prelim-card"><div class="row"><strong>${esc(p.name)}</strong><span class="muted small">${esc(p.domain)}</span><span class="badge">${esc(p.motion.replace(/_/g, ' '))}</span></div><p class="small">${esc(p.hypothesis)}</p><p class="small muted">${esc(p.evidenceNote)} — <a href="${esc(p.sourceUrl)}" rel="noopener nofollow">source</a></p></div>`).join('') || '<p class="muted small">Preliminary candidates will appear here as evidence lands…</p>'}
    </div></div>
  </div>
  <div>${budgetHtml}</div>
</div>`, { status: 'running', runId: view.id });
  }

  const r = view.results;
  if (!r) return layout('Run — Vector', '<p>Run state unavailable.</p>');

  const tabs: [string, string][] = [
    ['targets', `Top targets (${r.targets.length})`],
    ['watchlist', `Watchlist (${r.watchlist.length})`],
    ['universe', `Candidate universe (${r.universe.length})`],
    ['competitors', `Competitors (${r.competitors.length})`],
    ['signals', `Signals (${r.signals.length})`],
    ['evidence', `Evidence (${r.sources.length})`],
    ['trace', 'Decision trace'],
    ['methodology', 'Methodology'],
  ];

  const exportMenu = `<div class="row small">
    <span class="label">Export</span>
    ${['targets', 'universe', 'competitors', 'signals'].map((f) => `<a href="/api/runs/${esc(view.id)}/export?format=${f}">${f} CSV</a>`).join(' ')}
    <a href="/api/runs/${esc(view.id)}/export?format=report">report JSON</a>
    <a href="/api/runs/${esc(view.id)}/export?format=brief">brief MD</a>
  </div>`;

  const targetsTab = `
    ${r.rerankEvents.length ? `<div class="banner-demo" style="background:var(--teal-soft);border-color:var(--teal);color:var(--teal)">${r.rerankEvents.map((e) => `<div>↻ ${esc(e.reason)}</div>`).join('')}</div>` : ''}
    ${r.targets.length === 0 ? '<div class="card pad mt2"><p class="muted">No accounts passed qualification. Vector never pads the list with weak accounts — see the Watchlist for near-misses.</p></div>' : r.targets.map((t) => targetCardHtml(t, sources)).join('')}`;

  const universeTab = `<table class="vt mt2"><thead><tr><th>Company</th><th>Domain</th><th>Primary motion</th><th>Status</th><th>Note</th></tr></thead><tbody>
    ${r.universe.map((u) => `<tr><td>${esc(u.name)}</td><td class="muted">${esc(u.domain)}</td><td>${esc(u.motionPrimary.replace(/_/g, ' '))}</td><td><span class="badge ${u.status === 'qualified' ? 'teal' : u.status === 'excluded' || u.status === 'rejected' ? 'red' : u.status === 'watchlist' ? 'amber' : ''}">${esc(u.status.replace(/_/g, ' '))}</span></td><td class="small muted">${esc(u.note)}</td></tr>`).join('')}
  </tbody></table>`;

  const competitorsTab = `
    <table class="vt mt2"><thead><tr><th>Competitor</th><th>Category</th><th>Posture</th><th>Overlap</th><th>Confidence</th></tr></thead><tbody>
    ${r.competitors.map((cp) => `<tr><td><strong>${esc(cp.name)}</strong><div class="tiny muted">${esc(cp.domain)}</div></td><td>${esc(cp.category.replace(/_/g, ' '))}</td><td>${esc(cp.posture)}</td><td class="small muted">${esc(cp.productOverlap)}</td><td>${esc(cp.confidence)}</td></tr>`).join('')}
    </tbody></table>
    <div class="label mt3">Competitor customers</div>
    <table class="vt mt1"><thead><tr><th>Competitor</th><th>Customer</th><th>Relationship</th><th>Status</th><th>Posture</th><th>Caveats</th></tr></thead><tbody>
    ${r.competitorCustomers.map((cc) => `<tr><td>${esc(cc.competitor)}</td><td>${esc(cc.customer)}</td><td class="small">${esc(cc.relationship)}</td><td><span class="badge ${cc.status === 'unverified_lead' ? 'amber' : 'teal'}">${esc(cc.status.replace(/_/g, ' '))}</span></td><td>${esc(cc.posture)}</td><td class="small muted">${esc(cc.caveats)}</td></tr>`).join('')}
    </tbody></table>`;

  const signalsTab = `<table class="vt mt2"><thead><tr><th>Tier</th><th>Score</th><th>Event</th><th>Company</th><th>Dates</th><th>Verification</th></tr></thead><tbody>
    ${[...r.signals].sort((a, b) => b.score - a.score).map((s) => `<tr><td>${tierBadge(s.tier)}</td><td class="num">${s.score}/30</td><td class="small">${esc(s.eventDescription)}<div class="tiny muted">${esc(s.relevance)}</div></td><td class="small">${esc(s.companyId)}</td><td class="tiny muted">pub ${esc(s.publishedAt)}<br>ret ${esc(s.retrievedAt.slice(0, 10))}</td><td>${verBadge(s.verification)}</td></tr>`).join('')}
  </tbody></table>`;

  const evidenceTab = `<div class="mt2">${r.sources.map((s) => `<div class="card pad mt1"><div class="row small"><a href="${esc(s.url)}" rel="noopener noreferrer nofollow"><strong>${esc(s.title)}</strong></a><span class="muted">${esc(s.domain)}</span>${s.kind === 'search_snippet' ? '<span class="badge red">search snippet — never evidence</span>' : '<span class="badge">page</span>'}${s.publishedAt ? `<span class="tiny muted">published ${esc(s.publishedAt)}</span>` : ''}<span class="tiny muted">retrieved ${esc(s.retrievedAt.slice(0, 10))}</span></div><p class="small muted" style="margin-top:0.3rem">${esc(s.text.slice(0, 300))}${s.text.length > 300 ? '…' : ''}</p></div>`).join('')}</div>`;

  const traceByCandidate = new Map<string, typeof r.decisionTrace>();
  for (const entry of r.decisionTrace) {
    const list = traceByCandidate.get(entry.candidateId) ?? [];
    list.push(entry);
    traceByCandidate.set(entry.candidateId, list);
  }
  const traceTab = `<p class="small muted mt2">Bounded adaptive-loop decisions per deeply researched candidate (structured summaries only — never private model reasoning). Fast mode permits six actions per candidate.</p>
    ${[...traceByCandidate.entries()].map(([cid, entries]) => {
      const name = r.universe.find((u) => entries.length && u.domain && cid) && (r.targets.find((t) => t.candidate.id === cid)?.candidate.name ?? r.watchlist.find((w) => w.candidate.id === cid)?.candidate.name ?? cid);
      return `<div class="card pad mt2"><div class="row"><strong>${esc(name)}</strong>${entries.some((e) => e.stopReason) ? `<span class="badge">${esc(entries.find((e) => e.stopReason)?.stopReason ?? '')}</span>` : ''}</div>
      <table class="vt mt1"><thead><tr><th>#</th><th>Action</th><th>Evidence gap</th><th>Why</th><th>Outcome</th><th>Confidence</th></tr></thead><tbody>
      ${entries.map((e) => `<tr><td>${e.step}</td><td><code class="tiny">${esc(e.action)}</code></td><td class="small">${esc(e.gap)}</td><td class="small muted">${esc(e.rationale)}</td><td class="small">${esc(e.outcome)}</td><td class="tiny muted">${esc(e.confidenceBefore)} → ${esc(e.confidenceAfter)}${e.changedQualification ? '<br><span class="badge teal">changed qualification</span>' : ''}</td></tr>`).join('')}
      </tbody></table></div>`;
    }).join('')}`;

  const methodologyTab = `<div class="card pad mt2 small">
    <p>Signals are ranked by commercial meaning (tier 5 active buying → tier 0 non-signal), scored deterministically in TypeScript (${esc(view.scoringVersion)}), gated by nine qualification checks, and every displayed excerpt was verified as a verbatim substring of its retrieved source. Fewer than five targets is a valid honest answer.</p>
    <p><a href="/methodology">Read the full methodology →</a></p>
    <p class="tiny muted">Run mode: ${esc(view.mode)}. Evidence retrieved ${esc(view.retrievedAt.slice(0, 10))}. Startup profile confirmed by founder before research.</p>
  </div>`;

  return layout(`Targets for ${view.profile.name} — Vector`, `
${view.demo ? demoBanner : ''}
<div class="row between">
  <div><h1 style="font-size:1.6rem">Target accounts for ${esc(view.profile.name)}</h1>
  <p class="small muted">${r.targets.length} qualified target${r.targets.length === 1 ? '' : 's'} · ${r.watchlist.length} on watchlist · ${r.universe.length} candidates considered across ${new Set(r.universe.map((u) => u.motionPrimary)).size} discovery motions · ${view.metrics.sourcesReviewed} sources reviewed</p></div>
  ${exportMenu}
</div>
<div class="tabnav">${tabs.map(([id, label], i) => `<button data-tab="${id}" class="${i === 0 ? 'active' : ''}">${esc(label)}</button>`).join('')}</div>
<div id="tab-targets" class="tab-section">${targetsTab}</div>
<div id="tab-watchlist" class="tab-section" style="display:none">${r.watchlist.map(watchlistCardHtml).join('') || '<p class="muted small mt2">Nothing on the watchlist.</p>'}</div>
<div id="tab-universe" class="tab-section" style="display:none">${universeTab}</div>
<div id="tab-competitors" class="tab-section" style="display:none">${competitorsTab}</div>
<div id="tab-signals" class="tab-section" style="display:none">${signalsTab}</div>
<div id="tab-evidence" class="tab-section" style="display:none">${evidenceTab}</div>
<div id="tab-trace" class="tab-section" style="display:none">${traceTab}</div>
<div id="tab-methodology" class="tab-section" style="display:none">${methodologyTab}</div>
`, { status: view.status, runId: view.id });
}

// ---------------------------------------------------------------------------
export function methodologyPage(): string {
  const sections: [string, string][] = [
    ['CTO-style startup analysis', 'Vector does not stop at marketing categories. It builds a market observation model: the workflow the product changes, the systems it touches, what must already be true inside a customer, likely current tooling, failure modes that create demand, who feels the problem, who owns it, who funds it — and which externally observable signals reveal each of those conditions.'],
    ['Eight discovery motions', 'Candidates come from competitor displacement, trigger-first discovery (incidents, deadlines, cost programmes), use-case evidence, lookalikes of verified customers, technographic footprints, change events, procurement intent, and ecosystems. Competitor customers are one source among eight — a target can be found with no competitor relationship at all. Ecosystem membership may generate a candidate but can never qualify one.'],
    ['Two-pass funnel with an adaptive loop', 'Pass one generates up to 50 candidates and triages them cheaply on industry, geography, size, workflow evidence and exclusions. Roughly 12-15 survive into deep research, where a bounded adaptive loop (six actions per candidate in Fast mode) repeatedly picks the highest-value unresolved evidence gap from a typed action set, executes one action, and stops when gates pass, a disqualifier lands, the budget runs out, or public evidence is insufficient. Structured decision summaries are recorded and shown; private model reasoning is not.'],
    ['Commercial signal hierarchy', 'Signals are ranked by commercial meaning, not emotional negativity. Tier 5: active buying or displacement (RFPs, vendor evaluations, confirmed migrations) — 20 base points. Tier 4: forced or acute action (material incidents, regulatory deadlines) — 16. Tier 3: committed change (migration programmes, hiring clusters, mandated executives) — 12. Tier 2: explicit company-specific pain — 8. Tier 1: structural context — 4. Tier 0: generic commentary, anonymous complaints and search snippets — 0, and they can never contribute to qualification. Severity (0-4), authority (0-3) and specificity (0-3) adjust the base, capped at 30. An account scores its strongest verified event plus at most 3 points from one independent corroborating event: syndicated coverage of the same event is never double-counted, and a publicity-rich company cannot win on content volume.'],
    ['Evidence verification', 'Every material claim carries evidence records. Deterministic checks require the quoted excerpt to be a verbatim substring of the retrieved source, the source to exist in the run, entity identities to resolve, and dates to be compatible with any current-status claim. An entailment check then asks whether the excerpt supports the precise claim, or whether causality, currency or intent is being inferred without support. Failed claims are rejected or weakened — never silently upgraded. First-party status is judged relative to each claim, not globally per source. Excerpts are capped at 500 characters; whole articles are not stored.'],
    ['Qualification gates and deterministic scoring', 'Hard exclusions (the startup itself, existing customers, duplicates, no plausible workflow) apply before scoring. Nine gates then decide qualification — ICP fit at least 18/30, commercial signal at least 12/30 (or two independent events at 8+), an identified buyer function, two verified evidence records including one first-party or named-person record, no unresolved entity conflict, no failed material claim, and the ranking threshold. Scores are computed in TypeScript from fixed rubrics (ICP 30, signal 30, alternative 10, buyer 10, evidence quality 10, route 5, strategic 5); the model classifies enumerated inputs but never picks numbers. Fewer than five targets is a valid — and common — honest answer.'],
    ['People and public routes', 'The buying committee is derived from the workflow, never defaulted to the CEO. A named person is shown only when current employment is publicly supported by recent evidence; stale biographies and conflicts are flagged, and a strong account can qualify with a clear buyer function and no verified name. Public routes (shared investors, accelerators, co-authorship) are worth at most 5 ranking points, are described conservatively, and an affinity is never presented as a warm introduction.'],
    ['What Vector cannot know', 'Vector sees only public information. Private roadmaps, budgets, existing vendor contracts and org charts are invisible. Publicity bias is real: quiet companies under-signal, and Vector deliberately does not reward volume of coverage. Current-employment evidence decays quickly. Treat every recommendation as a research head start to validate, not a certainty.'],
  ];
  return layout('Methodology — Vector', `
<div style="max-width:46rem">
<h1>Methodology</h1>
<p class="small muted">How Vector turns a startup URL into up to five evidence-backed target accounts — and why it sometimes returns fewer.</p>
${sections.map(([t, b]) => `<section class="card pad mt2"><h2>${esc(t)}</h2><p class="small muted">${esc(b)}</p></section>`).join('')}
</div>`);
}
