import type { Claim, Source } from '@/lib/types';
import { CURRENT_STATUS_MAX_AGE_DAYS, MAX_EXCERPT_CHARS } from '@/config/scoring';

export function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Deterministic check 1: the quoted excerpt must be a verbatim substring of the source text. */
export function excerptIsVerbatim(excerpt: string, sourceText: string): boolean {
  if (!excerpt) return false;
  return normaliseWhitespace(sourceText).includes(normaliseWhitespace(excerpt));
}

export interface DeterministicCheckResult {
  ok: boolean;
  failures: string[];
}

/**
 * Deterministic verification of a claim against the sources retrieved in this run.
 * A valid source id is necessary but never sufficient: excerpts must be verbatim,
 * snippets cannot qualify, stale evidence cannot support current-status claims and
 * syndicated copies cannot masquerade as independent corroboration.
 */
export function verifyClaimDeterministic(
  claim: Claim,
  sourcesById: Map<string, Source>,
  now: Date = new Date(),
): DeterministicCheckResult {
  const failures: string[] = [];
  if (claim.evidence.length === 0) failures.push('no_evidence');
  const hashesSeen = new Set<string>();
  for (const ev of claim.evidence) {
    const source = sourcesById.get(ev.sourceId);
    if (!source) {
      failures.push(`unknown_source_id:${ev.sourceId}`);
      continue;
    }
    if (source.kind === 'search_snippet') {
      failures.push(`search_snippet_cannot_qualify:${ev.sourceId}`);
    }
    if (!excerptIsVerbatim(ev.excerpt, source.text)) {
      failures.push(`excerpt_not_verbatim:${ev.sourceId}`);
    }
    if (ev.excerpt.length > MAX_EXCERPT_CHARS) {
      failures.push(`excerpt_exceeds_cap:${ev.sourceId}`);
    }
    if (claim.currentStatusClaim && source.publishedAt) {
      const ageDays = (now.getTime() - Date.parse(source.publishedAt)) / 86_400_000;
      if (ageDays > CURRENT_STATUS_MAX_AGE_DAYS) {
        failures.push(`stale_evidence_for_current_status:${ev.sourceId}`);
      }
    }
    if (hashesSeen.has(source.contentHash)) {
      failures.push(`syndicated_duplicate_presented_as_corroboration:${ev.sourceId}`);
    }
    hashesSeen.add(source.contentHash);
  }
  return { ok: failures.length === 0, failures };
}

/** Only verified facts and verified supported inferences may appear on qualified target cards. */
export function claimCanQualify(claim: Claim): boolean {
  return claim.classification !== 'speculation' && claim.verification === 'verified';
}

/** Group syndicated copies of the same content into one evidence family by content hash. */
export function groupSyndication(sources: Source[]): Map<string, Source[]> {
  const groups = new Map<string, Source[]>();
  for (const s of sources) {
    const family = groups.get(s.contentHash) ?? [];
    family.push(s);
    groups.set(s.contentHash, family);
  }
  return groups;
}

/** Independent evidence = distinct content families, not raw source count. */
export function independentEvidenceCount(claim: Claim, sourcesById: Map<string, Source>): number {
  const hashes = new Set<string>();
  for (const ev of claim.evidence) {
    const s = sourcesById.get(ev.sourceId);
    if (s && s.kind !== 'search_snippet') hashes.add(s.contentHash);
  }
  return hashes.size;
}

/** Count verified, non-snippet evidence records across a candidate's qualifying claims. */
export function verifiedEvidenceCount(claims: Claim[], sourcesById: Map<string, Source>): number {
  let count = 0;
  for (const claim of claims) {
    if (!claimCanQualify(claim)) continue;
    for (const ev of claim.evidence) {
      const s = sourcesById.get(ev.sourceId);
      if (s && s.kind !== 'search_snippet' && ev.entailment === 'supports') count += 1;
    }
  }
  return count;
}
