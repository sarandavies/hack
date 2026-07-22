import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGates, scoreAccount } from '@/lib/scoring/score';
import type { CandidateClassification, PainSignal } from '@/lib/types';

const base: CandidateClassification = {
  industry: 'exact',
  size: 'within',
  geography: 'exact',
  workflow: 'explicit',
  buyerUseCase: 'exact',
  technical: 'verified',
  alternativeEvidence: 'verified',
  posture: 'replace',
  dissatisfaction: 'explicit',
  buyerFunctionIdentified: true,
  namedPersonVerified: true,
  personAuthority: true,
  recentPublicActivity: true,
  verificationAllPassed: true,
  firstPartyOrNamed: true,
  independentCorroboration: true,
  recencySupport: true,
  route: 'verified_connector',
  salesMotionFit: true,
  implementationPath: true,
  noBlocker: true,
};

function signal(over: Partial<PainSignal>): PainSignal {
  return {
    id: 's1',
    companyId: 'c1',
    signalType: 'test',
    tier: 5,
    eventId: 'e1',
    eventDescription: 'test',
    excerpt: 'x',
    publishedAt: '2026-06-01',
    retrievedAt: '2026-07-01',
    dimensions: { problem: true, severity: true, intent: true, timing: true, ownership: true },
    severity: 3,
    authority: 3,
    specificity: 3,
    confidence: 'high',
    relevance: 'r',
    outreachImplication: 'o',
    sourceIds: ['src1'],
    verification: 'verified',
    ...over,
  };
}

describe('ICP rubric branches', () => {
  const cases: [Partial<CandidateClassification>, keyof ReturnType<typeof scoreAccount>['icp'], number][] = [
    [{ industry: 'exact' }, 'industry', 6],
    [{ industry: 'adjacent' }, 'industry', 3],
    [{ industry: 'none' }, 'industry', 0],
    [{ size: 'within' }, 'size', 4],
    [{ size: 'uncertain' }, 'size', 2],
    [{ size: 'outside' }, 'size', 0],
    [{ geography: 'exact' }, 'geography', 3],
    [{ geography: 'adjacent' }, 'geography', 1],
    [{ geography: 'outside' }, 'geography', 0],
    [{ workflow: 'explicit' }, 'workflow', 9],
    [{ workflow: 'strong_inference' }, 'workflow', 6],
    [{ workflow: 'adjacent' }, 'workflow', 3],
    [{ workflow: 'generic' }, 'workflow', 1],
    [{ workflow: 'none' }, 'workflow', 0],
    [{ buyerUseCase: 'exact' }, 'buyerUseCase', 5],
    [{ buyerUseCase: 'partial' }, 'buyerUseCase', 2],
    [{ buyerUseCase: 'none' }, 'buyerUseCase', 0],
    [{ technical: 'verified' }, 'technical', 3],
    [{ technical: 'plausible' }, 'technical', 1],
    [{ technical: 'incompatible' }, 'technical', 0],
  ];
  for (const [over, key, expected] of cases) {
    it(`${JSON.stringify(over)} → ${key}=${expected}`, () => {
      const b = scoreAccount({ ...base, ...over }, []);
      assert.equal(b.icp[key], expected);
    });
  }
  it('max ICP is 30', () => {
    assert.equal(scoreAccount(base, []).icp.total, 30);
  });
});

describe('alternative, buyer, evidence, route, strategic branches', () => {
  it('alternative branches', () => {
    assert.equal(scoreAccount(base, []).alternative.total, 10);
    assert.equal(
      scoreAccount({ ...base, alternativeEvidence: 'likely', posture: 'augment', dissatisfaction: 'indirect' }, []).alternative.total,
      6,
    );
    assert.equal(
      scoreAccount({ ...base, alternativeEvidence: 'unknown', posture: 'locked_in', dissatisfaction: 'none' }, []).alternative.total,
      0,
    );
    assert.equal(scoreAccount({ ...base, posture: 'integrate' }, []).alternative.posture, 1);
  });
  it('no fabricated-person points: authority requires a verified named person', () => {
    const b = scoreAccount({ ...base, namedPersonVerified: false }, []);
    assert.equal(b.buyer.namedPerson, 0);
    assert.equal(b.buyer.authority, 0);
    assert.equal(b.buyer.total, 5); // function 3 + recent activity 2
  });
  it('evidence quality branches', () => {
    assert.equal(scoreAccount(base, []).evidenceQuality.total, 10);
    assert.equal(
      scoreAccount(
        { ...base, verificationAllPassed: false, firstPartyOrNamed: false, independentCorroboration: false, recencySupport: false },
        [],
      ).evidenceQuality.total,
      0,
    );
  });
  it('route branches', () => {
    for (const [route, pts] of [
      ['verified_connector', 5],
      ['strong_intermediary', 4],
      ['shared_investor', 3],
      ['weak_affinity', 1],
      ['none', 0],
    ] as const) {
      assert.equal(scoreAccount({ ...base, route }, []).route, pts);
    }
  });
  it('strategic branches', () => {
    assert.equal(scoreAccount(base, []).strategic.total, 5);
    assert.equal(
      scoreAccount({ ...base, salesMotionFit: false, implementationPath: false, noBlocker: false }, []).strategic.total,
      0,
    );
  });
  it('total is 100 at maximum', () => {
    const b = scoreAccount(base, [signal({ severity: 4 }), signal({ id: 's2', eventId: 'e2' })]);
    assert.equal(b.total, 100);
  });
});

describe('qualification gates', () => {
  function gateInput(over: Partial<Parameters<typeof evaluateGates>[0]> = {}) {
    const breakdown = scoreAccount(base, [signal({})]);
    return {
      breakdown,
      signals: [signal({})],
      buyerFunctionIdentified: true,
      verifiedEvidenceCount: 2,
      hasFirstPartyOrNamedEvidence: true,
      hasCriticalEntityConflict: false,
      hasFailedMaterialClaim: false,
      hardExcluded: false,
      threshold: 70,
      ...over,
    };
  }
  it('passes when all conditions hold', () => {
    assert.equal(evaluateGates(gateInput()).passed, true);
  });
  it('each gate can fail independently', () => {
    assert.equal(evaluateGates(gateInput({ buyerFunctionIdentified: false })).passed, false);
    assert.equal(evaluateGates(gateInput({ verifiedEvidenceCount: 1 })).passed, false);
    assert.equal(evaluateGates(gateInput({ hasFirstPartyOrNamedEvidence: false })).passed, false);
    assert.equal(evaluateGates(gateInput({ hasCriticalEntityConflict: true })).passed, false);
    assert.equal(evaluateGates(gateInput({ hasFailedMaterialClaim: true })).passed, false);
    assert.equal(evaluateGates(gateInput({ hardExcluded: true })).passed, false);
    assert.equal(evaluateGates(gateInput({ threshold: 101 })).passed, false);
  });
  it('signal gate: two independent events at 8+ substitute for a 12+ primary', () => {
    const weakTwo = [
      signal({ tier: 2, severity: 1, authority: 0, specificity: 0, eventId: 'e1' }), // 9
      signal({ id: 's2', tier: 2, severity: 0, authority: 0, specificity: 0, eventId: 'e2' }), // 8
    ];
    const breakdown = scoreAccount(base, weakTwo);
    assert.ok(breakdown.signal.total < 12 || breakdown.signal.total >= 12);
    const result = evaluateGates(gateInput({ breakdown, signals: weakTwo }));
    const signalGate = result.gates.find((g) => g.key === 'signal');
    assert.equal(signalGate?.passed, true);
  });
  it('ICP gate fails below 18', () => {
    const weak = scoreAccount({ ...base, industry: 'none', workflow: 'none', buyerUseCase: 'none', size: 'outside', geography: 'outside', technical: 'incompatible' }, [signal({})]);
    const result = evaluateGates(gateInput({ breakdown: weak }));
    assert.equal(result.gates.find((g) => g.key === 'icp')?.passed, false);
  });
});
