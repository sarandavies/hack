import { DEFAULT_QUALIFICATION_THRESHOLD } from './scoring.js';

export interface ServerEnv {
  DATABASE_URL: string;
  DEMO_MODE: boolean;
  LIVE_RESEARCH_ENABLED: boolean;
  DEMO_ACCESS_CODE: string;
  AI_PROVIDER: string;
  AI_MODEL: string;
  ANTHROPIC_API_KEY: string;
  AI_GATEWAY_API_KEY: string;
  EXA_API_KEY: string;
  BRAVE_SEARCH_API_KEY: string;
  FIRECRAWL_API_KEY: string;
  APP_URL: string;
  ENABLE_DIAGNOSTICS: boolean;
  DEFAULT_RESEARCH_MODE: 'fast' | 'thorough';
  RESEARCH_QUALIFICATION_THRESHOLD: number;
  FAST_RUN_MAX_COST_USD: number;
  THOROUGH_RUN_MAX_COST_USD: number;
  REAL_DEMO_STARTUP_URL: string;
  EVAL_STARTUP_URLS: string;
  DEMO_TIME_SCALE: number;
}

function str(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}
function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  if (v !== 'true' && v !== 'false') throw new Error(`Invalid env ${name}: expected true|false`);
  return v === 'true';
}
function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Invalid env ${name}: expected a number`);
  return n;
}

let cached: ServerEnv | null = null;

/** Validate server environment on first access. Demo mode requires no secrets. */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  const mode = str('DEFAULT_RESEARCH_MODE', 'fast');
  if (mode !== 'fast' && mode !== 'thorough') {
    throw new Error('Invalid env DEFAULT_RESEARCH_MODE: expected fast|thorough');
  }
  cached = {
    DATABASE_URL: str('DATABASE_URL'),
    DEMO_MODE: bool('DEMO_MODE', true),
    LIVE_RESEARCH_ENABLED: bool('LIVE_RESEARCH_ENABLED', false),
    DEMO_ACCESS_CODE: str('DEMO_ACCESS_CODE'),
    AI_PROVIDER: str('AI_PROVIDER', 'anthropic'),
    AI_MODEL: str('AI_MODEL', 'claude-sonnet-5'),
    ANTHROPIC_API_KEY: str('ANTHROPIC_API_KEY'),
    AI_GATEWAY_API_KEY: str('AI_GATEWAY_API_KEY'),
    EXA_API_KEY: str('EXA_API_KEY'),
    BRAVE_SEARCH_API_KEY: str('BRAVE_SEARCH_API_KEY'),
    FIRECRAWL_API_KEY: str('FIRECRAWL_API_KEY'),
    APP_URL: str('APP_URL', 'http://localhost:3000'),
    ENABLE_DIAGNOSTICS: bool('ENABLE_DIAGNOSTICS', false),
    DEFAULT_RESEARCH_MODE: mode,
    RESEARCH_QUALIFICATION_THRESHOLD: num(
      'RESEARCH_QUALIFICATION_THRESHOLD',
      DEFAULT_QUALIFICATION_THRESHOLD,
    ),
    FAST_RUN_MAX_COST_USD: num('FAST_RUN_MAX_COST_USD', 2.5),
    THOROUGH_RUN_MAX_COST_USD: num('THOROUGH_RUN_MAX_COST_USD', 10),
    REAL_DEMO_STARTUP_URL: str('REAL_DEMO_STARTUP_URL'),
    EVAL_STARTUP_URLS: str('EVAL_STARTUP_URLS'),
    DEMO_TIME_SCALE: num('DEMO_TIME_SCALE', 1),
  };
  return cached;
}

/** Test hook: clear the cached env (used when tests mutate process.env). */
export function resetEnvCache(): void {
  cached = null;
}

export function liveResearchAvailable(): boolean {
  const env = getEnv();
  return (
    env.LIVE_RESEARCH_ENABLED &&
    Boolean(env.ANTHROPIC_API_KEY || env.AI_GATEWAY_API_KEY) &&
    Boolean(env.EXA_API_KEY || env.BRAVE_SEARCH_API_KEY)
  );
}
