import type { PainSignal, SignalView } from '../types.js';
import { CORROBORATION_MAX, SIGNAL_MAX, TIER_BASE_POINTS } from '../../config/scoring.js';

/** Tier-0 items and unverified signals can never contribute to qualification or score. */
export function qualifiesForScoring(signal: PainSignal): boolean {
  return signal.tier > 0 && signal.verification === 'verified';
}

export function computeSignalPoints(signal: PainSignal): {
  basePoints: number;
  adjustmentPoints: number;
  score: number;
} {
  const basePoints = TIER_BASE_POINTS[signal.tier];
  const adjustmentPoints = signal.severity + signal.authority + signal.specificity;
  if (!qualifiesForScoring(signal)) {
    return { basePoints: signal.tier === 0 ? 0 : basePoints, adjustmentPoints, score: 0 };
  }
  return {
    basePoints,
    adjustmentPoints,
    score: Math.min(SIGNAL_MAX, basePoints + adjustmentPoints),
  };
}

export function toSignalView(signal: PainSignal): SignalView {
  return { ...signal, ...computeSignalPoints(signal) };
}

export interface AccountSignalScore {
  primaryEventId?: string;
  primaryScore: number;
  corroborationBonus: number;
  total: number;
}

/**
 * Account-level score: strongest verified underlying event, plus up to three points
 * from ONE independent corroborating event (different eventId). No quantity bonus,
 * no double-counting of syndicated coverage of the same event.
 */
export function accountSignalScore(signals: PainSignal[]): AccountSignalScore {
  const scored = signals
    .filter(qualifiesForScoring)
    .map((s) => ({ signal: s, score: computeSignalPoints(s).score }))
    .sort((a, b) => b.score - a.score);
  const primary = scored[0];
  if (!primary) return { primaryScore: 0, corroborationBonus: 0, total: 0 };
  const corroborating = scored.find((s) => s.signal.eventId !== primary.signal.eventId);
  const corroborationBonus = corroborating
    ? Math.min(CORROBORATION_MAX, SIGNAL_MAX - primary.score)
    : 0;
  return {
    primaryEventId: primary.signal.eventId,
    primaryScore: primary.score,
    corroborationBonus,
    total: Math.min(SIGNAL_MAX, primary.score + corroborationBonus),
  };
}

/** Count independent (distinct underlying event) verified signals scoring at least `min`. */
export function independentStrongSignals(signals: PainSignal[], min: number): number {
  const events = new Map<string, number>();
  for (const s of signals.filter(qualifiesForScoring)) {
    const { score } = computeSignalPoints(s);
    const existing = events.get(s.eventId) ?? 0;
    if (score > existing) events.set(s.eventId, score);
  }
  return [...events.values()].filter((v) => v >= min).length;
}
