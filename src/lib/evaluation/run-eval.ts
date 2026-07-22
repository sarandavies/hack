// Live evaluation harness. Runs only with real credentials; never claims results
// that were not measured, and never substitutes synthetic data for live evidence.
import { getEnv, liveResearchAvailable } from '../../config/env.js';

interface EvalMetrics {
  url: string;
  completed: boolean;
  durationSeconds?: number;
  estimatedCostUsd?: number;
  qualifiedTargets?: number;
  claimsRejectedByVerification?: number;
  fabricatedClaims?: number;
  notes: string[];
}

export const REVIEW_LABELS = [
  'worth_investigating',
  'plausible_but_weak',
  'irrelevant',
  'incorrect',
  'evidence_supports_claim',
  'evidence_partially_supports_claim',
  'evidence_does_not_support_claim',
] as const;

async function main() {
  const env = getEnv();
  const cliUrl = process.argv.find((a) => a.startsWith('--url='))?.slice(6);
  const urls = cliUrl ? [cliUrl] : env.EVAL_STARTUP_URLS.split(',').map((s) => s.trim()).filter(Boolean);

  if (urls.length === 0) {
    console.error('Usage: npm run eval:live -- --url=https://example-startup.com (or set EVAL_STARTUP_URLS)');
    process.exit(2);
  }
  if (!liveResearchAvailable()) {
    console.error(
      'Live evaluation requires LIVE_RESEARCH_ENABLED=true, an AI key (ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY) and a search key (EXA_API_KEY or BRAVE_SEARCH_API_KEY).',
    );
    console.error('No credentials found in this environment — no evaluation was run, and no results are claimed.');
    process.exit(3);
  }

  const results: EvalMetrics[] = [];
  for (const url of urls) {
    // The live orchestrator wires SearchProvider + PageExtractionProvider + LLMProvider
    // (src/lib/providers) through the same deterministic funnel used by the demo engine.
    // This build's live loop is not yet implemented end to end; report honestly.
    results.push({
      url,
      completed: false,
      notes: [
        'Live orchestration loop not yet wired end to end in this build (see README known limitations).',
        'Provider adapters (Exa search, native safe-fetch extraction, Anthropic structured output) are implemented and unit-covered.',
      ],
    });
  }
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), reviewLabels: REVIEW_LABELS, results }, null, 2));
  process.exit(results.every((r) => r.completed) ? 0 : 1);
}

main();
