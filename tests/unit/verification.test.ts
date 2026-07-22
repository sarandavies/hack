import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  claimCanQualify,
  excerptIsVerbatim,
  groupSyndication,
  verifyClaimDeterministic,
} from '@/lib/verification/verify';
import type { Claim, Source } from '@/lib/types';

function source(over: Partial<Source>): Source {
  return {
    id: 'src1',
    url: 'https://example.com/a',
    domain: 'example.com',
    title: 'A',
    publishedAt: '2026-06-01',
    retrievedAt: '2026-07-01T00:00:00Z',
    kind: 'page',
    contentHash: 'h1',
    text: 'The quick brown fox jumps over the lazy dog. It was a fine day.',
    ...over,
  };
}
function claim(over: Partial<Claim>): Claim {
  return {
    id: 'c1',
    text: 'test claim',
    type: 'workflow',
    classification: 'fact',
    entityIds: [],
    evidence: [
      {
        sourceId: 'src1',
        excerpt: 'The quick brown fox jumps over the lazy dog.',
        firstParty: true,
        relationship: 'r',
        entailment: 'supports',
      },
    ],
    verification: 'verified',
    confidence: 'high',
    promptVersion: 'v1',
    modelVersion: 'm1',
    material: true,
    ...over,
  };
}
const NOW = new Date('2026-07-22T00:00:00Z');

describe('verbatim excerpt check', () => {
  it('accepts exact substrings and normalises whitespace', () => {
    assert.equal(excerptIsVerbatim('quick  brown\nfox', 'The quick brown fox jumps'), true);
  });
  it('rejects paraphrases and empty excerpts', () => {
    assert.equal(excerptIsVerbatim('The fast brown fox', 'The quick brown fox'), false);
    assert.equal(excerptIsVerbatim('', 'anything'), false);
  });
});

describe('deterministic claim verification', () => {
  const sources = new Map([['src1', source({})]]);

  it('passes a well-formed claim', () => {
    assert.deepEqual(verifyClaimDeterministic(claim({}), sources, NOW), { ok: true, failures: [] });
  });
  it('rejects unknown source ids — valid ids are necessary, never sufficient', () => {
    const result = verifyClaimDeterministic(
      claim({ evidence: [{ sourceId: 'src_missing', excerpt: 'x', firstParty: false, relationship: 'r', entailment: 'supports' }] }),
      sources,
      NOW,
    );
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((f) => f.startsWith('unknown_source_id')));
  });
  it('rejects search snippets as qualifying evidence', () => {
    const snip = new Map([['snip', source({ id: 'snip', kind: 'search_snippet' })]]);
    const result = verifyClaimDeterministic(
      claim({ evidence: [{ sourceId: 'snip', excerpt: 'The quick brown fox jumps over the lazy dog.', firstParty: false, relationship: 'r', entailment: 'supports' }] }),
      snip,
      NOW,
    );
    assert.ok(result.failures.some((f) => f.startsWith('search_snippet_cannot_qualify')));
  });
  it('rejects non-verbatim excerpts', () => {
    const result = verifyClaimDeterministic(
      claim({ evidence: [{ sourceId: 'src1', excerpt: 'A totally invented quotation', firstParty: false, relationship: 'r', entailment: 'supports' }] }),
      sources,
      NOW,
    );
    assert.ok(result.failures.some((f) => f.startsWith('excerpt_not_verbatim')));
  });
  it('rejects stale evidence for current-status claims', () => {
    const stale = new Map([['old', source({ id: 'old', publishedAt: '2023-01-01', text: 'Jane is VP of Data.' })]]);
    const result = verifyClaimDeterministic(
      claim({ currentStatusClaim: true, evidence: [{ sourceId: 'old', excerpt: 'Jane is VP of Data.', firstParty: false, relationship: 'r', entailment: 'supports' }] }),
      stale,
      NOW,
    );
    assert.ok(result.failures.some((f) => f.startsWith('stale_evidence_for_current_status')));
  });
  it('rejects syndicated duplicates presented as corroboration', () => {
    const dupes = new Map([
      ['a', source({ id: 'a', contentHash: 'same' })],
      ['b', source({ id: 'b', url: 'https://mirror.example/a', contentHash: 'same' })],
    ]);
    const result = verifyClaimDeterministic(
      claim({
        evidence: [
          { sourceId: 'a', excerpt: 'The quick brown fox jumps over the lazy dog.', firstParty: false, relationship: 'r', entailment: 'supports' },
          { sourceId: 'b', excerpt: 'The quick brown fox jumps over the lazy dog.', firstParty: false, relationship: 'r', entailment: 'supports' },
        ],
      }),
      dupes,
      NOW,
    );
    assert.ok(result.failures.some((f) => f.startsWith('syndicated_duplicate')));
  });
  it('rejects claims with no evidence', () => {
    const result = verifyClaimDeterministic(claim({ evidence: [] }), sources, NOW);
    assert.ok(result.failures.includes('no_evidence'));
  });
});

describe('qualification rules for claims', () => {
  it('only verified non-speculation claims can qualify', () => {
    assert.equal(claimCanQualify(claim({})), true);
    assert.equal(claimCanQualify(claim({ verification: 'partially_verified' })), false);
    assert.equal(claimCanQualify(claim({ verification: 'failed' })), false);
    assert.equal(claimCanQualify(claim({ classification: 'speculation', verification: 'verified' })), false);
  });
});

describe('syndication grouping', () => {
  it('groups sources by content hash into evidence families', () => {
    const groups = groupSyndication([
      source({ id: 'a', contentHash: 'x' }),
      source({ id: 'b', contentHash: 'x' }),
      source({ id: 'c', contentHash: 'y' }),
    ]);
    assert.equal(groups.size, 2);
    assert.equal(groups.get('x')?.length, 2);
  });
});
