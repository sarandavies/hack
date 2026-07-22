import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  accountSignalScore,
  computeSignalPoints,
  independentStrongSignals,
  qualifiesForScoring,
} from '@/lib/scoring/signal-tiers';
import type { PainSignal, SignalTier } from '@/lib/types';

function sig(over: Partial<PainSignal>): PainSignal {
  return {
    id: 'sig',
    companyId: 'c',
    signalType: 't',
    tier: 3,
    eventId: 'evt1',
    eventDescription: 'd',
    excerpt: 'x',
    publishedAt: '2026-06-01',
    retrievedAt: '2026-07-01',
    dimensions: { problem: true, severity: false, intent: false, timing: false, ownership: false },
    severity: 0,
    authority: 0,
    specificity: 0,
    confidence: 'high',
    relevance: 'r',
    outreachImplication: 'o',
    sourceIds: [],
    verification: 'verified',
    ...over,
  };
}

describe('signal tier points', () => {
  const bases: [SignalTier, number][] = [
    [5, 20],
    [4, 16],
    [3, 12],
    [2, 8],
    [1, 4],
    [0, 0],
  ];
  for (const [tier, expected] of bases) {
    it(`tier ${tier} base = ${expected}`, () => {
      assert.equal(computeSignalPoints(sig({ tier })).basePoints, expected);
    });
  }
  it('adjustments add severity+authority+specificity', () => {
    assert.equal(computeSignalPoints(sig({ tier: 3, severity: 4, authority: 3, specificity: 3 })).score, 22);
  });
  it('score caps at 30', () => {
    assert.equal(computeSignalPoints(sig({ tier: 5, severity: 4, authority: 3, specificity: 3 })).score, 30);
  });
  it('tier 0 can never score or qualify', () => {
    const t0 = sig({ tier: 0, severity: 4, authority: 3, specificity: 3 });
    assert.equal(qualifiesForScoring(t0), false);
    assert.equal(computeSignalPoints(t0).score, 0);
  });
  it('unverified signals cannot score', () => {
    assert.equal(computeSignalPoints(sig({ verification: 'unverified' })).score, 0);
    assert.equal(computeSignalPoints(sig({ verification: 'failed' })).score, 0);
  });
});

describe('account-level signal score', () => {
  it('uses strongest event as primary', () => {
    const result = accountSignalScore([sig({ tier: 2 }), sig({ id: 'b', tier: 5, eventId: 'evt2' })]);
    assert.equal(result.primaryEventId, 'evt2');
    assert.equal(result.primaryScore, 20);
  });
  it('same underlying event never double-counts (no corroboration bonus)', () => {
    const result = accountSignalScore([
      sig({ tier: 3, eventId: 'evtX' }),
      sig({ id: 'b', tier: 2, eventId: 'evtX' }),
    ]);
    assert.equal(result.corroborationBonus, 0);
    assert.equal(result.total, 12);
  });
  it('one independent event adds at most 3 points; more events add nothing', () => {
    const result = accountSignalScore([
      sig({ tier: 3, eventId: 'e1' }),
      sig({ id: 'b', tier: 3, eventId: 'e2' }),
      sig({ id: 'c', tier: 3, eventId: 'e3' }),
      sig({ id: 'd', tier: 3, eventId: 'e4' }),
    ]);
    assert.equal(result.total, 15); // 12 + 3, regardless of extra events (no volume bonus)
  });
  it('total never exceeds 30', () => {
    const result = accountSignalScore([
      sig({ tier: 5, severity: 4, authority: 3, specificity: 3, eventId: 'e1' }),
      sig({ id: 'b', tier: 5, eventId: 'e2' }),
    ]);
    assert.equal(result.total, 30);
  });
  it('empty or all-tier-0 input scores zero', () => {
    assert.equal(accountSignalScore([]).total, 0);
    assert.equal(accountSignalScore([sig({ tier: 0 })]).total, 0);
  });
});

describe('independent strong signals', () => {
  it('counts distinct events at or above the threshold', () => {
    const signals = [
      sig({ tier: 2, eventId: 'e1' }), // 8
      sig({ id: 'b', tier: 2, eventId: 'e1' }), // duplicate event
      sig({ id: 'c', tier: 3, eventId: 'e2' }), // 12
      sig({ id: 'd', tier: 1, eventId: 'e3' }), // 4 — below
    ];
    assert.equal(independentStrongSignals(signals, 8), 2);
  });
});
