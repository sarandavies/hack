import type { RunView, TargetView } from '../types.js';

/** Escape a CSV cell: quote-double, wrap, and neutralise spreadsheet formula injection. */
export function csvCell(value: string | number | boolean | undefined | null): string {
  let s = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: (string | number | boolean | undefined | null)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

export function sanitiseFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100);
}

function targetRow(t: TargetView): (string | number)[] {
  const strongest = t.signals[0];
  return [
    t.rank,
    t.candidate.name,
    t.candidate.domain,
    t.candidate.motionPrimary,
    t.breakdown.total,
    `qualified`,
    strongest ? `tier_${strongest.tier}` : '',
    strongest ? strongest.eventDescription : '',
    t.candidate.buyerFunction ?? '',
    t.candidate.people.map((p) => `${p.name} (${p.title})`).join('; '),
    t.breakdown.icp.total,
    t.breakdown.signal.total,
    t.breakdown.alternative.total,
    t.breakdown.buyer.total,
    t.breakdown.evidenceQuality.total,
    t.breakdown.route,
    t.breakdown.strategic.total,
    t.claims
      .flatMap((c) => c.evidence.map((e) => e.sourceId))
      .join('; '),
  ];
}

export function buildTargetsCsv(view: RunView): string {
  const header = [
    'rank',
    'company',
    'domain',
    'discovery_motion',
    'total_score',
    'qualification',
    'signal_tier',
    'strongest_signal',
    'buyer_function',
    'people',
    'icp_score',
    'signal_score',
    'alternative_score',
    'buyer_score',
    'evidence_score',
    'route_score',
    'strategic_score',
    'evidence_source_ids',
  ];
  const rows = (view.results?.targets ?? []).map(targetRow);
  return toCsv([header, ...rows]);
}

export function buildUniverseCsv(view: RunView): string {
  const header = ['company', 'domain', 'primary_motion', 'status', 'note'];
  const rows = (view.results?.universe ?? []).map((u) => [
    u.name,
    u.domain,
    u.motionPrimary,
    u.status,
    u.note,
  ]);
  return toCsv([header, ...rows]);
}

export function buildCompetitorsCsv(view: RunView): string {
  const header = ['company', 'domain', 'category', 'posture', 'product_overlap', 'confidence'];
  const rows = (view.results?.competitors ?? []).map((c) => [
    c.name,
    c.domain,
    c.category,
    c.posture,
    c.productOverlap,
    c.confidence,
  ]);
  return toCsv([header, ...rows]);
}

export function buildSignalsCsv(view: RunView): string {
  const header = [
    'company_id',
    'tier',
    'score',
    'event',
    'signal_type',
    'published',
    'retrieved',
    'verification',
    'excerpt',
  ];
  const rows = (view.results?.signals ?? []).map((s) => [
    s.companyId,
    s.tier,
    s.score,
    s.eventDescription,
    s.signalType,
    s.publishedAt,
    s.retrievedAt,
    s.verification,
    s.excerpt,
  ]);
  return toCsv([header, ...rows]);
}

export function buildReportJson(view: RunView): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      run: view,
      note: 'Vector structured report. All claims carry evidence records with verification status.',
    },
    null,
    2,
  );
}

export function buildBriefMarkdown(view: RunView): string {
  const lines: string[] = [
    `# Vector account brief — ${view.profile.name}`,
    '',
    `Mode: ${view.mode}. Retrieved: ${view.retrievedAt}. Scoring: ${view.scoringVersion}.`,
    view.demo ? '\n> Synthetic demo data — fictional companies on reserved .example domains.\n' : '',
  ];
  for (const t of view.results?.targets ?? []) {
    lines.push(`## ${t.rank}. ${t.candidate.name} (${t.candidate.domain}) — ${t.breakdown.total}/100`);
    lines.push(`**Why this fits:** ${t.candidate.whyFits?.icpMatch ?? ''}`);
    lines.push(`**Why now:** ${t.candidate.whyNow?.trigger ?? ''}`);
    const strongest = t.signals[0];
    if (strongest) {
      lines.push(
        `**Strongest signal (tier ${strongest.tier}, ${strongest.score}/30):** ${strongest.eventDescription}`,
      );
    }
    if (t.candidate.people.length > 0) {
      lines.push('**Who to contact:**');
      for (const p of t.candidate.people) {
        lines.push(`- ${p.name}, ${p.title} (${p.buyingRole}) — ${p.sourceUrl}`);
      }
    } else if (t.candidate.buyerFunction) {
      lines.push(`**Buyer function:** ${t.candidate.buyerFunction} (no named current person verified)`);
    }
    lines.push(`**Approach:** ${t.candidate.approach?.angle ?? ''}`);
    lines.push('');
  }
  return lines.join('\n');
}
