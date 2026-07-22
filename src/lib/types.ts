// Core domain model for Vector. All timestamps are ISO-8601 strings (timezone-aware).

export type ResearchMode = 'fast' | 'thorough';
export type SignalTier = 0 | 1 | 2 | 3 | 4 | 5;
export type Confidence = 'high' | 'medium' | 'low';
export type EntailmentStatus =
  | 'supports'
  | 'partially_supports'
  | 'does_not_support'
  | 'contradicts'
  | 'unclear';
export type VerificationStatus = 'verified' | 'partially_verified' | 'failed' | 'unverified';
export type ClaimClassification = 'fact' | 'supported_inference' | 'speculation';
export type DiscoveryMotion =
  | 'displacement'
  | 'trigger'
  | 'use_case'
  | 'lookalike'
  | 'technographic'
  | 'change_event'
  | 'procurement'
  | 'ecosystem';
export type SourceKind = 'page' | 'search_snippet';

export interface Source {
  id: string;
  url: string;
  domain: string;
  title: string;
  publishedAt?: string;
  retrievedAt: string;
  kind: SourceKind;
  contentHash: string;
  /** Retained supporting text (bounded excerpt of the page, never the whole article). */
  text: string;
}

export interface ClaimEvidence {
  sourceId: string;
  excerpt: string;
  /** First-party status is relative to THIS claim, not global to the source. */
  firstParty: boolean;
  relationship: string;
  entailment: EntailmentStatus;
}

export interface Claim {
  id: string;
  text: string;
  type: string;
  classification: ClaimClassification;
  entityIds: string[];
  evidence: ClaimEvidence[];
  verification: VerificationStatus;
  confidence: Confidence;
  /** True when the claim asserts a *current* state of the world (employment, current customer, etc.). */
  currentStatusClaim?: boolean;
  conflict?: string;
  promptVersion: string;
  modelVersion: string;
  /** Material claims are required for qualification; failure blocks the gate. */
  material: boolean;
}

export type BuyingRole =
  | 'economic_buyer'
  | 'functional_owner'
  | 'technical_evaluator'
  | 'internal_champion'
  | 'practitioner'
  | 'procurement';
export type EmploymentStatus = 'current_verified' | 'uncertain' | 'stale' | 'conflicting';

export interface Person {
  id: string;
  name: string;
  title: string;
  company: string;
  buyingRole: BuyingRole;
  why: string;
  sourceUrl: string;
  sourceTitle: string;
  evidenceDate: string;
  confidence: Confidence;
  employmentStatus: EmploymentStatus;
  conflictNote?: string;
}

export interface SignalDimensions {
  problem: boolean;
  severity: boolean;
  intent: boolean;
  timing: boolean;
  ownership: boolean;
}

export interface PainSignal {
  id: string;
  companyId: string;
  personName?: string;
  personRole?: string;
  signalType: string;
  tier: SignalTier;
  /** Underlying-event id used to prevent double counting of one event across sources. */
  eventId: string;
  eventDescription: string;
  excerpt: string;
  publishedAt: string;
  retrievedAt: string;
  dimensions: SignalDimensions;
  severity: 0 | 1 | 2 | 3 | 4;
  authority: 0 | 1 | 2 | 3;
  specificity: 0 | 1 | 2 | 3;
  confidence: Confidence;
  relevance: string;
  outreachImplication: string;
  sourceIds: string[];
  verification: VerificationStatus;
}

export interface SignalView extends PainSignal {
  basePoints: number;
  adjustmentPoints: number;
  score: number;
}

export interface CandidateClassification {
  industry: 'exact' | 'adjacent' | 'none';
  size: 'within' | 'uncertain' | 'outside';
  geography: 'exact' | 'adjacent' | 'outside';
  workflow: 'explicit' | 'strong_inference' | 'adjacent' | 'generic' | 'none';
  buyerUseCase: 'exact' | 'partial' | 'none';
  technical: 'verified' | 'plausible' | 'incompatible';
  alternativeEvidence: 'verified' | 'likely' | 'unknown';
  posture: 'replace' | 'augment' | 'integrate' | 'locked_in';
  dissatisfaction: 'explicit' | 'indirect' | 'none';
  buyerFunctionIdentified: boolean;
  namedPersonVerified: boolean;
  personAuthority: boolean;
  recentPublicActivity: boolean;
  verificationAllPassed: boolean;
  firstPartyOrNamed: boolean;
  independentCorroboration: boolean;
  recencySupport: boolean;
  route: 'verified_connector' | 'strong_intermediary' | 'shared_investor' | 'weak_affinity' | 'none';
  salesMotionFit: boolean;
  implementationPath: boolean;
  noBlocker: boolean;
}

export interface ScoreBreakdown {
  icp: {
    industry: number;
    size: number;
    geography: number;
    workflow: number;
    buyerUseCase: number;
    technical: number;
    total: number;
  };
  signal: {
    primaryEventId?: string;
    primaryScore: number;
    corroborationBonus: number;
    total: number;
  };
  alternative: { evidence: number; posture: number; dissatisfaction: number; total: number };
  buyer: {
    functionIdentified: number;
    namedPerson: number;
    authority: number;
    recentActivity: number;
    total: number;
  };
  evidenceQuality: {
    verificationPassed: number;
    firstPartyOrNamed: number;
    corroboration: number;
    recency: number;
    total: number;
  };
  route: number;
  strategic: { salesMotion: number; implementation: number; noBlocker: number; total: number };
  total: number;
  version: string;
}

export interface GateCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}
export interface GateResult {
  passed: boolean;
  gates: GateCheck[];
}

export type CandidateStatus =
  | 'universe'
  | 'triaged_out'
  | 'deep'
  | 'qualified'
  | 'watchlist'
  | 'rejected'
  | 'excluded';

export interface WhyFits {
  icpMatch: string;
  useCase: string;
  technicalFit: string;
  currentAlternative?: string;
  affectedWorkflow: string;
}
export interface WhyNow {
  strongestSignalId: string;
  supportingSignalIds: string[];
  trigger: string;
  commercialImplication: string;
  signalOwner?: string;
}
export interface Approach {
  angle: string;
  openingQuestion: string;
  reasonNow: string;
  uncertainty: string;
  connector?: string;
}
export interface PublicRoute {
  type: string;
  description: string;
  sourceId?: string;
  caveat: string;
}

export interface Candidate {
  id: string;
  companyId: string;
  name: string;
  domain: string;
  description: string;
  industry: string;
  geography: string;
  sizeEstimate: string;
  businessUnit: string;
  motionPrimary: DiscoveryMotion;
  motions: DiscoveryMotion[];
  discoverySourceIds: string[];
  fitHypothesis: string;
  risks: string[];
  status: CandidateStatus;
  hardExclusion?: string;
  watchlistReason?: string;
  rejectionReason?: string;
  classification?: CandidateClassification;
  signalIds: string[];
  claimIds: string[];
  people: Person[];
  buyerFunction?: string;
  buyerFunctionNote?: string;
  whyFits?: WhyFits;
  whyNow?: WhyNow;
  approach?: Approach;
  publicRoute?: PublicRoute;
  conflicts: string[];
  hasCriticalEntityConflict?: boolean;
  /** Explicitly labelled speculation. Never affects qualification. */
  researchNotes?: string[];
}

export interface CompetitorAssessment {
  id: string;
  name: string;
  domain: string;
  category: 'direct' | 'adjacent' | 'incumbent' | 'internal_alternative';
  productOverlap: string;
  useCaseOverlap: string;
  buyerOverlap: string;
  architectureOverlap: string;
  posture: 'replace' | 'augment' | 'integrate' | 'coexist';
  evidenceIds: string[];
  confidence: Confidence;
  conflicts: string[];
}

export interface CompetitorCustomer {
  competitor: string;
  customer: string;
  relationship: string;
  status: 'current' | 'historical' | 'unverified_lead';
  firstObserved: string;
  lastEvidence: string;
  posture: string;
  sourceIds: string[];
  confidence: Confidence;
  caveats: string;
}

export interface DecisionTraceEntry {
  candidateId: string;
  step: number;
  action: string;
  gap: string;
  rationale: string;
  queryOrSource?: string;
  outcome: string;
  confidenceBefore: Confidence;
  confidenceAfter: Confidence;
  changedQualification: boolean;
  stopReason?: string;
}

export interface StartupProfile {
  name: string;
  domain: string;
  oneLiner: string;
  description: string;
  category: string;
  coreProblem: string;
  primaryUseCases: string[];
  secondaryUseCases: string[];
  primaryUsers: string[];
  economicBuyers: string[];
  functionalOwners: string[];
  technicalEvaluators: string[];
  workflows: string[];
  targetIndustries: string[];
  targetSizes: string;
  targetGeographies: string[];
  requiredTechnicalConditions: string[];
  incompatibleConditions: string[];
  currentAlternatives: string[];
  knownCompetitors: string[];
  existingCustomers: string[];
  technicalVocabulary: string[];
  buyerVocabulary: string[];
  painVocabulary: string[];
  procurementVocabulary: string[];
  observableSignals: string[];
  exclusionCriteria: string[];
  confidence: Confidence;
  evidenceRefs: string[];
}

export interface MarketObservationModel {
  workflow_description: string;
  affected_systems: string[];
  technical_prerequisites: string[];
  organisational_prerequisites: string[];
  likely_current_stack: string[];
  replaceable_alternatives: string[];
  augmentable_alternatives: string[];
  integration_dependencies: string[];
  likely_failure_modes: string[];
  economic_costs: string[];
  operational_costs: string[];
  security_or_compliance_costs: string[];
  buyer_roles: string[];
  practitioner_roles: string[];
  observable_company_signals: string[];
  observable_person_signals: string[];
  high_intent_phrases: string[];
  pain_phrases: string[];
  technical_synonyms: string[];
  procurement_phrases: string[];
  disqualifying_conditions: string[];
}

export interface UniverseEntry {
  name: string;
  domain: string;
  motionPrimary: DiscoveryMotion;
  status: CandidateStatus;
  note: string;
}

export type FeedbackType =
  | 'irrelevant'
  | 'promising'
  | 'exclude'
  | 'note'
  | 'competitor_incorrect'
  | 'deeper_research';
export interface FeedbackItem {
  id: string;
  candidateId: string;
  type: FeedbackType;
  reason?: string;
  createdAt: string;
}

export interface RunStageView {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}
export interface BudgetLine {
  used: number;
  limit: number;
}
export interface BudgetView {
  searchQueries: BudgetLine;
  pagesFetched: BudgetLine;
  estCostUsd: BudgetLine;
  elapsedSeconds: BudgetLine;
}
export interface PreliminaryCandidate {
  candidateId: string;
  name: string;
  domain: string;
  motion: DiscoveryMotion;
  hypothesis: string;
  evidenceNote: string;
  sourceUrl: string;
}
export interface TargetView {
  candidate: Candidate;
  breakdown: ScoreBreakdown;
  gates: GateResult;
  rank: number;
  signals: SignalView[];
  claims: Claim[];
  promising?: boolean;
}
export interface WatchlistView {
  candidate: Candidate;
  breakdown: ScoreBreakdown;
  gates: GateResult;
  reason: string;
}
export interface RerankEvent {
  reason: string;
  at: string;
}
export interface RunResults {
  targets: TargetView[];
  watchlist: WatchlistView[];
  universe: UniverseEntry[];
  competitors: CompetitorAssessment[];
  competitorCustomers: CompetitorCustomer[];
  signals: SignalView[];
  decisionTrace: DecisionTraceEntry[];
  sources: Source[];
  rerankEvents: RerankEvent[];
}
export interface RunMetrics {
  sourcesReviewed: number;
  companiesConsidered: number;
  queriesUsed: number;
}
export interface RunView {
  id: string;
  url: string;
  mode: ResearchMode;
  demo: boolean;
  status: 'running' | 'completed' | 'partial' | 'failed';
  startedAt: string;
  retrievedAt: string;
  stages: RunStageView[];
  metrics: RunMetrics;
  budget: BudgetView;
  preliminaryCandidates: PreliminaryCandidate[];
  results?: RunResults;
  partialReason?: string;
  profile: StartupProfile;
  feedback: FeedbackItem[];
  scoringVersion: string;
}
