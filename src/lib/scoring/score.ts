import type {
  CandidateClassification,
  GateCheck,
  GateResult,
  PainSignal,
  ScoreBreakdown,
} from '../types.js';
import {
  ALTERNATIVE_POINTS,
  BUYER_POINTS,
  EVIDENCE_POINTS,
  GATE_ALT_SIGNAL_EACH,
  GATE_MIN_ICP,
  GATE_MIN_SIGNAL,
  GATE_MIN_VERIFIED_EVIDENCE,
  ICP_POINTS,
  ROUTE_POINTS,
  SCORING_VERSION,
  STRATEGIC_POINTS,
} from '../../config/scoring.js';
import { accountSignalScore, independentStrongSignals } from './signal-tiers.js';

/**
 * Deterministic account scoring. The model classifies enumerated inputs; every
 * number comes from the fixed rubric in src/config/scoring.ts. Total 0-100.
 */
export function scoreAccount(
  c: CandidateClassification,
  signals: PainSignal[],
): ScoreBreakdown {
  const icp = {
    industry: ICP_POINTS.industry[c.industry],
    size: ICP_POINTS.size[c.size],
    geography: ICP_POINTS.geography[c.geography],
    workflow: ICP_POINTS.workflow[c.workflow],
    buyerUseCase: ICP_POINTS.buyerUseCase[c.buyerUseCase],
    technical: ICP_POINTS.technical[c.technical],
    total: 0,
  };
  icp.total =
    icp.industry + icp.size + icp.geography + icp.workflow + icp.buyerUseCase + icp.technical;

  const signal = accountSignalScore(signals);

  const alternative = {
    evidence: ALTERNATIVE_POINTS.evidence[c.alternativeEvidence],
    posture: ALTERNATIVE_POINTS.posture[c.posture],
    dissatisfaction: ALTERNATIVE_POINTS.dissatisfaction[c.dissatisfaction],
    total: 0,
  };
  alternative.total = alternative.evidence + alternative.posture + alternative.dissatisfaction;

  const buyer = {
    functionIdentified: c.buyerFunctionIdentified ? BUYER_POINTS.functionIdentified : 0,
    namedPerson: c.namedPersonVerified ? BUYER_POINTS.namedPerson : 0,
    authority: c.namedPersonVerified && c.personAuthority ? BUYER_POINTS.authority : 0,
    recentActivity: c.recentPublicActivity ? BUYER_POINTS.recentActivity : 0,
    total: 0,
  };
  buyer.total = buyer.functionIdentified + buyer.namedPerson + buyer.authority + buyer.recentActivity;

  const evidenceQuality = {
    verificationPassed: c.verificationAllPassed ? EVIDENCE_POINTS.verificationPassed : 0,
    firstPartyOrNamed: c.firstPartyOrNamed ? EVIDENCE_POINTS.firstPartyOrNamed : 0,
    corroboration: c.independentCorroboration ? EVIDENCE_POINTS.corroboration : 0,
    recency: c.recencySupport ? EVIDENCE_POINTS.recency : 0,
    total: 0,
  };
  evidenceQuality.total =
    evidenceQuality.verificationPassed +
    evidenceQuality.firstPartyOrNamed +
    evidenceQuality.corroboration +
    evidenceQuality.recency;

  const route = ROUTE_POINTS[c.route];

  const strategic = {
    salesMotion: c.salesMotionFit ? STRATEGIC_POINTS.salesMotion : 0,
    implementation: c.implementationPath ? STRATEGIC_POINTS.implementation : 0,
    noBlocker: c.noBlocker ? STRATEGIC_POINTS.noBlocker : 0,
    total: 0,
  };
  strategic.total = strategic.salesMotion + strategic.implementation + strategic.noBlocker;

  const total =
    icp.total +
    signal.total +
    alternative.total +
    buyer.total +
    evidenceQuality.total +
    route +
    strategic.total;

  return {
    icp,
    signal: {
      primaryEventId: signal.primaryEventId,
      primaryScore: signal.primaryScore,
      corroborationBonus: signal.corroborationBonus,
      total: signal.total,
    },
    alternative,
    buyer,
    evidenceQuality,
    route,
    strategic,
    total,
    version: SCORING_VERSION,
  };
}

export interface GateInput {
  breakdown: ScoreBreakdown;
  signals: PainSignal[];
  buyerFunctionIdentified: boolean;
  verifiedEvidenceCount: number;
  hasFirstPartyOrNamedEvidence: boolean;
  hasCriticalEntityConflict: boolean;
  hasFailedMaterialClaim: boolean;
  hardExcluded: boolean;
  threshold: number;
}

/** Qualification gates are separate from ranking. All nine must pass for Top targets. */
export function evaluateGates(input: GateInput): GateResult {
  const { breakdown } = input;
  const strongIndependent = independentStrongSignals(input.signals, GATE_ALT_SIGNAL_EACH);
  const gates: GateCheck[] = [
    {
      key: 'icp',
      label: `ICP fit ≥ ${GATE_MIN_ICP}/30`,
      passed: breakdown.icp.total >= GATE_MIN_ICP,
      detail: `Scored ${breakdown.icp.total}/30`,
    },
    {
      key: 'signal',
      label: `Commercial signal ≥ ${GATE_MIN_SIGNAL}/30 or two independent signals ≥ ${GATE_ALT_SIGNAL_EACH}`,
      passed: breakdown.signal.total >= GATE_MIN_SIGNAL || strongIndependent >= 2,
      detail: `Signal ${breakdown.signal.total}/30; ${strongIndependent} independent strong event(s)`,
    },
    {
      key: 'buyer_function',
      label: 'Relevant buyer function identified',
      passed: input.buyerFunctionIdentified,
      detail: input.buyerFunctionIdentified ? 'Buyer function identified' : 'No buyer function identified',
    },
    {
      key: 'verified_evidence',
      label: `At least ${GATE_MIN_VERIFIED_EVIDENCE} substantive verified evidence records`,
      passed: input.verifiedEvidenceCount >= GATE_MIN_VERIFIED_EVIDENCE,
      detail: `${input.verifiedEvidenceCount} verified evidence record(s)`,
    },
    {
      key: 'first_party',
      label: 'At least one first-party or named-person evidence record',
      passed: input.hasFirstPartyOrNamedEvidence,
      detail: input.hasFirstPartyOrNamedEvidence ? 'Present' : 'Absent',
    },
    {
      key: 'entity_conflict',
      label: 'No unresolved critical entity conflict',
      passed: !input.hasCriticalEntityConflict,
      detail: input.hasCriticalEntityConflict ? 'Unresolved entity conflict' : 'None',
    },
    {
      key: 'claim_verification',
      label: 'No failed material claim',
      passed: !input.hasFailedMaterialClaim,
      detail: input.hasFailedMaterialClaim ? 'A material claim failed verification' : 'None failed',
    },
    {
      key: 'threshold',
      label: `Total ranking score ≥ ${input.threshold}`,
      passed: breakdown.total >= input.threshold,
      detail: `Scored ${breakdown.total}/100`,
    },
    {
      key: 'not_excluded',
      label: 'Not hard-excluded',
      passed: !input.hardExcluded,
      detail: input.hardExcluded ? 'Hard exclusion applies' : 'Not excluded',
    },
  ];
  return { passed: gates.every((g) => g.passed), gates };
}
