import { getEnv } from '../../config/env';
import type { SearchProvider, SearchResult } from './types';

/** Deterministic demo search provider — used only in synthetic demo mode. */
export class DemoSearchProvider implements SearchProvider {
  name = 'demo';
  async search(): Promise<SearchResult[]> {
    // Synthetic demo mode never performs network search; results come from fixtures.
    return [];
  }
}

/** Exa search provider (primary live search). Results are discovery leads, never evidence. */
export class ExaSearchProvider implements SearchProvider {
  name = 'exa';
  constructor(private apiKey: string) {}

  async search(query: string, opts?: { maxResults?: number }): Promise<SearchResult[]> {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
      body: JSON.stringify({
        query,
        numResults: Math.min(opts?.maxResults ?? 10, 10),
        contents: { text: { maxCharacters: 4000 } },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`exa_error:${res.status}`);
    const data = (await res.json()) as {
      results?: { title?: string; url: string; text?: string; publishedDate?: string }[];
    };
    return (data.results ?? []).map((r) => ({
      title: r.title ?? r.url,
      url: r.url,
      snippet: (r.text ?? '').slice(0, 300),
      publishedAt: r.publishedDate,
      content: r.text,
    }));
  }
}

/** Brave search provider (secondary, P1). */
export class BraveSearchProvider implements SearchProvider {
  name = 'brave';
  constructor(private apiKey: string) {}

  async search(query: string, opts?: { maxResults?: number }): Promise<SearchResult[]> {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(Math.min(opts?.maxResults ?? 10, 20)));
    const res = await fetch(url, {
      headers: { 'x-subscription-token': this.apiKey, accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`brave_error:${res.status}`);
    const data = (await res.json()) as {
      web?: { results?: { title: string; url: string; description?: string }[] };
    };
    return (data.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description ?? '',
    }));
  }
}

export function getSearchProvider(): SearchProvider {
  const env = getEnv();
  if (env.EXA_API_KEY) return new ExaSearchProvider(env.EXA_API_KEY);
  if (env.BRAVE_SEARCH_API_KEY) return new BraveSearchProvider(env.BRAVE_SEARCH_API_KEY);
  return new DemoSearchProvider();
}
