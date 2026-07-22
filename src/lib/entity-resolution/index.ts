import type { EmploymentStatus } from '../types.js';

const TRACKING_PARAMS = /^(utm_|gclid|fbclid|mc_cid|mc_eid|ref|igshid)/;
const CORPORATE_SUFFIXES = new Set([
  'inc',
  'ltd',
  'limited',
  'llc',
  'gmbh',
  'plc',
  'corp',
  'corporation',
  'co',
  'company',
  'ab',
  'bv',
  'sa',
  'oy',
  'as',
  'srl',
  'pty',
]);

/** Canonicalise a URL for identity comparison: scheme, www, tracking params, trailing slash. */
export function canonicaliseUrl(raw: string): string {
  let input = raw.trim();
  if (!/^[a-z]+:\/\//i.test(input)) input = `https://${input}`;
  const url = new URL(input);
  let host = url.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  const params = new URLSearchParams();
  const sortedKeys = [...url.searchParams.keys()].filter((k) => !TRACKING_PARAMS.test(k)).sort();
  for (const k of sortedKeys) {
    const v = url.searchParams.get(k);
    if (v !== null) params.set(k, v);
  }
  let path = url.pathname.replace(/\/+$/, '');
  if (path === '') path = '';
  const query = params.toString();
  return `${host}${path}${query ? `?${query}` : ''}`;
}

/** Canonical domain is Vector's preferred company identity. */
export function canonicalDomain(raw: string): string {
  const canonical = canonicaliseUrl(raw);
  const slash = canonical.indexOf('/');
  const q = canonical.indexOf('?');
  const end = Math.min(slash === -1 ? canonical.length : slash, q === -1 ? canonical.length : q);
  return canonical.slice(0, end);
}

export function normaliseCompanyName(name: string): string {
  const tokens = name
    .toLowerCase()
    .replace(/[.,()&]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    if (last && CORPORATE_SUFFIXES.has(last)) tokens.pop();
    else break;
  }
  return tokens.join(' ');
}

export interface CompanyRef {
  name: string;
  domain?: string;
}
export interface MatchResult {
  match: boolean;
  confident: boolean;
  reason: string;
}

/** Never merge companies on similar name alone — a name match without domain corroboration stays unmerged. */
export function companiesMatch(a: CompanyRef, b: CompanyRef): MatchResult {
  if (a.domain && b.domain) {
    if (canonicalDomain(a.domain) === canonicalDomain(b.domain)) {
      return { match: true, confident: true, reason: 'canonical_domain_match' };
    }
    return { match: false, confident: true, reason: 'different_domains' };
  }
  if (normaliseCompanyName(a.name) === normaliseCompanyName(b.name)) {
    return { match: false, confident: false, reason: 'name_only_requires_corroboration' };
  }
  return { match: false, confident: true, reason: 'no_match' };
}

/** Current employment is time-sensitive. Old biographies never prove current employment. */
export function assessEmployment(opts: {
  evidenceDate: string;
  now?: Date;
  conflicting?: boolean;
}): EmploymentStatus {
  if (opts.conflicting) return 'conflicting';
  const now = opts.now ?? new Date();
  const ageDays = (now.getTime() - Date.parse(opts.evidenceDate)) / 86_400_000;
  if (ageDays <= 365) return 'current_verified';
  if (ageDays <= 730) return 'uncertain';
  return 'stale';
}
