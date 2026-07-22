// Every scoring constant lives in this module so the rubric is configurable in one place.
import type { SignalTier } from '@/lib/types';

export const SCORING_VERSION = 'vector-scoring-v1';

export const ICP_POINTS = {
  industry: { exact: 6, adjacent: 3, none: 0 },
  size: { within: 4, uncertain: 2, outside: 0 },
  geography: { exact: 3, adjacent: 1, outside: 0 },
  workflow: { explicit: 9, strong_inference: 6, adjacent: 3, generic: 1, none: 0 },
  buyerUseCase: { exact: 5, partial: 2, none: 0 },
  technical: { verified: 3, plausible: 1, incompatible: 0 },
} as const;

export const TIER_BASE_POINTS: Record<SignalTier, number> = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
};
export const SIGNAL_MAX = 30;
export const CORROBORATION_MAX = 3;

export const ALTERNATIVE_POINTS = {
  evidence: { verified: 4, likely: 2, unknown: 0 },
  posture: { replace: 4, augment: 3, integrate: 1, locked_in: 0 },
  dissatisfaction: { explicit: 2, indirect: 1, none: 0 },
} as const;

export const BUYER_POINTS = {
  functionIdentified: 3,
  namedPerson: 3,
  authority: 2,
  recentActivity: 2,
} as const;

export const EVIDENCE_POINTS = {
  verificationPassed: 4,
  firstPartyOrNamed: 2,
  corroboration: 2,
  recency: 2,
} as const;

export const ROUTE_POINTS = {
  verified_connector: 5,
  strong_intermediary: 4,
  shared_investor: 3,
  weak_affinity: 1,
  none: 0,
} as const;

export const STRATEGIC_POINTS = {
  salesMotion: 2,
  implementation: 2,
  noBlocker: 1,
} as const;

// Qualification gates
export const GATE_MIN_ICP = 18;
export const GATE_MIN_SIGNAL = 12;
export const GATE_ALT_SIGNAL_EACH = 8;
export const GATE_MIN_VERIFIED_EVIDENCE = 2;
export const DEFAULT_QUALIFICATION_THRESHOLD = 70;

// Evidence display rules
export const MAX_EXCERPT_CHARS = 500;
// A current-status claim needs evidence newer than this many days.
export const CURRENT_STATUS_MAX_AGE_DAYS = 548; // 18 months
