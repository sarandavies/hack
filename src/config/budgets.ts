import type { ResearchMode } from '@/lib/types';

export interface ModeBudget {
  firstPreliminarySeconds: number;
  shortlistSeconds: number;
  maxWallClockSeconds: number;
  maxCandidateUniverse: number;
  maxDeepCandidates: number;
  maxNamedPersonCandidates: number;
  maxPublicRouteCandidates: number;
  maxSearchQueries: number;
  maxFetchedPages: number;
  maxAdaptiveActionsPerCandidate: number;
  maxSourcesPerModelCall: number;
  maxModelInputTokens: number;
  maxModelOutputTokens: number;
  defaultMaxCostUsd: number;
}

export const BUDGETS: Record<ResearchMode, ModeBudget> = {
  fast: {
    firstPreliminarySeconds: 90,
    shortlistSeconds: 300,
    maxWallClockSeconds: 360,
    maxCandidateUniverse: 50,
    maxDeepCandidates: 15,
    maxNamedPersonCandidates: 8,
    maxPublicRouteCandidates: 5,
    maxSearchQueries: 25,
    maxFetchedPages: 20,
    maxAdaptiveActionsPerCandidate: 6,
    maxSourcesPerModelCall: 12,
    maxModelInputTokens: 350_000,
    maxModelOutputTokens: 35_000,
    defaultMaxCostUsd: 2.5,
  },
  thorough: {
    firstPreliminarySeconds: 180,
    shortlistSeconds: 780,
    maxWallClockSeconds: 900,
    maxCandidateUniverse: 100,
    maxDeepCandidates: 25,
    maxNamedPersonCandidates: 15,
    maxPublicRouteCandidates: 8,
    maxSearchQueries: 70,
    maxFetchedPages: 60,
    maxAdaptiveActionsPerCandidate: 12,
    maxSourcesPerModelCall: 18,
    maxModelInputTokens: 1_200_000,
    maxModelOutputTokens: 100_000,
    defaultMaxCostUsd: 10,
  },
};

// Budget pressure thresholds (fraction of budget consumed).
export const BUDGET_PRIORITISE_AT = 0.7;
export const BUDGET_STOP_LOW_VALUE_AT = 0.8;
export const BUDGET_TERMINATE_AT = 1.0;

// Cache TTLs (seconds)
export const CACHE_TTLS = {
  searchResults: 24 * 3600,
  pageExtraction: 7 * 24 * 3600,
  companyProfile: 7 * 24 * 3600,
  employmentAndPain: 24 * 3600,
  staticDocs: 30 * 24 * 3600,
};
