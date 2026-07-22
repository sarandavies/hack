// The synthetic fixture must obey the same evidence rules as live research:
// every excerpt verbatim, every source id resolvable, no snippet used as qualifying
// evidence, fictional .example domains only, and declared statuses consistent with
// the deterministic gates. The fixture is self-verifying.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  demoCandidates,
  demoClaims,
  demoSignals,
  demoSources,
  demoUniverse,
} from '@/data/demo/tramline';
import { verifyClaimDeterministic } from '@/lib/verification/verify';
import { excerptIsVerbatim } from '@/lib/verification/verify';
import { MAX_EXCERPT_CHARS } from '@/config/scoring';

const NOW = new Date('2026-07-22T00:00:00Z');
const sourcesById = new Map(demoSources.map((s) => [s.id, s]));

describe('fixture evidence integrity', () => {
  it('every claim passes deterministic verification against its sources', () => {
    for (const claim of demoClaims) {
      const result = verifyClaimDeterministic(claim, sourcesById, NOW);
      assert.deepEqual(result.failures, [], `claim ${claim.id}: ${result.failures.join(', ')}`);
    }
  });
  it('every signal excerpt is verbatim in at least one cited source', () => {
    for (const signal of demoSignals) {
      const ok = signal.sourceIds.some((id) => {
        const src = sourcesById.get(id);
        return src ? excerptIsVerbatim(signal.excerpt, src.text) : false;
      });
      assert.ok(ok, `signal ${signal.id} excerpt not verbatim in cited sources`);
    }
  });
  it('all displayed excerpts respect the 500-character cap', () => {
    for (const claim of demoClaims) {
      for (const ev of claim.evidence) {
        assert.ok(ev.excerpt.length <= MAX_EXCERPT_CHARS, `${claim.id}/${ev.sourceId}`);
      }
    }
    for (const s of demoSignals) assert.ok(s.excerpt.length <= MAX_EXCERPT_CHARS, s.id);
  });
  it('every source and candidate domain is a reserved fictional domain', () => {
    for (const s of demoSources) {
      assert.ok(s.domain.endsWith('.example'), `source ${s.id} domain ${s.domain}`);
    }
    for (const c of demoCandidates) {
      assert.ok(c.domain === '—' || c.domain.endsWith('.example'), `candidate ${c.id}`);
    }
    for (const u of demoUniverse) assert.ok(u.domain.endsWith('.example'), u.name);
  });
  it('candidate signal and claim references all resolve', () => {
    const signalIds = new Set(demoSignals.map((s) => s.id));
    const claimIds = new Set(demoClaims.map((c) => c.id));
    for (const c of demoCandidates) {
      for (const id of c.signalIds) assert.ok(signalIds.has(id), `${c.id} → ${id}`);
      for (const id of c.claimIds) assert.ok(claimIds.has(id), `${c.id} → ${id}`);
    }
  });
  it('search snippets are never cited as claim evidence', () => {
    for (const claim of demoClaims) {
      for (const ev of claim.evidence) {
        assert.notEqual(sourcesById.get(ev.sourceId)?.kind, 'search_snippet', claim.id);
      }
    }
  });
  it('the fixture includes the required example variety', () => {
    assert.ok(demoClaims.some((c) => c.verification === 'failed'), 'a rejected claim');
    assert.ok(demoClaims.some((c) => c.verification === 'partially_verified'), 'a partial claim');
    assert.ok(demoSignals.some((s) => s.tier === 0), 'a tier-0 non-signal');
    assert.ok(demoSignals.some((s) => s.tier === 5), 'a strong buying-intent signal');
    assert.ok(demoCandidates.some((c) => c.status === 'watchlist'), 'a watchlist target');
    assert.ok(demoCandidates.some((c) => c.hardExclusion), 'a hard exclusion');
    assert.ok(demoCandidates.some((c) => c.hasCriticalEntityConflict), 'an entity conflict');
    assert.ok(
      demoCandidates.some((c) => c.people.some((p) => p.employmentStatus === 'conflicting')),
      'conflicting employment evidence',
    );
    assert.ok(demoSources.some((s) => s.kind === 'search_snippet'), 'an incorrect search lead');
  });
});
