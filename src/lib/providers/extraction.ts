import { safeFetch } from '../security/ssrf.js';
import type { ExtractedPage, PageExtractionProvider } from './types.js';

/** Strip tags/scripts for a readable text body. Retrieved content is hostile data. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Native safe-fetch extraction with SSRF guards. Firecrawl remains an optional P1 fallback. */
export class NativeExtractionProvider implements PageExtractionProvider {
  name = 'native-fetch';

  async extract(url: string): Promise<ExtractedPage> {
    const res = await safeFetch(url);
    if (!res.ok) throw new Error(`fetch_failed:${res.status}`);
    const html = await res.text();
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    return {
      url,
      title: titleMatch?.[1] ? htmlToText(titleMatch[1]) : url,
      text: htmlToText(html).slice(0, 40_000),
      retrievedAt: new Date().toISOString(),
    };
  }
}

export function getExtractionProvider(): PageExtractionProvider {
  return new NativeExtractionProvider();
}
