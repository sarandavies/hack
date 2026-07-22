// Provider architecture: modular interfaces, no overbuild. Demo mode is fixture-driven;
// live mode plugs Exa (search), safe fetch + readability (extraction) and Anthropic (LLM).

import type { RunView } from '@/lib/types';

/** Minimal schema contract (zod-compatible): parse validates or throws. */
export interface SchemaLike<T> {
  parse(value: unknown): T;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  /** Full page content when the search provider returns it. */
  content?: string;
}

export interface SearchProvider {
  name: string;
  search(query: string, opts?: { maxResults?: number }): Promise<SearchResult[]>;
}

export interface ExtractedPage {
  url: string;
  title: string;
  text: string;
  retrievedAt: string;
}

export interface PageExtractionProvider {
  name: string;
  extract(url: string): Promise<ExtractedPage>;
}

export interface StructuredCallOptions<T> {
  system: string;
  /** Untrusted source records are delimited by the caller; never placed in system. */
  user: string;
  schema: SchemaLike<T>;
  maxOutputTokens?: number;
  effort?: 'low' | 'medium' | 'high';
}

export interface LLMProvider {
  name: string;
  structured<T>(opts: StructuredCallOptions<T>): Promise<T>;
}

export interface ResearchStore {
  saveStageOutput(runId: string, stage: string, version: number, output: unknown): Promise<void>;
  getStageOutput(runId: string, stage: string): Promise<unknown | undefined>;
}

export interface ResearchOrchestrator {
  start(runId: string): Promise<void>;
  getView(runId: string): Promise<RunView | undefined>;
}

export interface ProviderCallRecord {
  provider: string;
  operation: string;
  startedAt: string;
  durationMs: number;
  estimatedCostUsd: number;
  ok: boolean;
  error?: string;
}
