// SSRF guard: retrieved-web infrastructure must never reach private networks.

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', 'metadata.goog']);

export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast/reserved
  return false;
}

export function isPrivateIpv6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (v === '::1' || v === '::') return true;
  if (v.startsWith('fc') || v.startsWith('fd')) return true; // unique local
  if (v.startsWith('fe80')) return true; // link-local
  if (v.startsWith('::ffff:')) return isPrivateIpv4(v.slice(7));
  return false;
}

export interface UrlValidation {
  ok: boolean;
  reason?: string;
}

/** Validate a model-proposed or user-supplied URL before any server-side fetch. */
export function validateFetchUrl(raw: string): UrlValidation {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'blocked_protocol' };
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return { ok: false, reason: 'blocked_host' };
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && isPrivateIpv4(host)) {
    return { ok: false, reason: 'private_ip' };
  }
  if (host.includes(':') || raw.includes('[')) {
    if (isPrivateIpv6(host)) return { ok: false, reason: 'private_ip' };
  }
  return { ok: true };
}

export const FETCH_LIMITS = {
  maxRedirects: 3,
  timeoutMs: 10_000,
  maxBytes: 2_000_000,
};

/**
 * Safe server-side fetch used by live extraction: validates the URL, resolves DNS to
 * reject private addresses, revalidates every redirect, bounds time and size.
 */
export async function safeFetch(rawUrl: string): Promise<Response> {
  let current = rawUrl;
  for (let hop = 0; hop <= FETCH_LIMITS.maxRedirects; hop++) {
    const check = validateFetchUrl(current);
    if (!check.ok) throw new Error(`ssrf_blocked:${check.reason}`);
    const { hostname } = new URL(current);
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && !hostname.includes(':')) {
      const { lookup } = await import('node:dns/promises');
      const resolved = await lookup(hostname, { all: true });
      for (const addr of resolved) {
        if (addr.family === 4 && isPrivateIpv4(addr.address)) throw new Error('ssrf_blocked:dns_private_ip');
        if (addr.family === 6 && isPrivateIpv6(addr.address)) throw new Error('ssrf_blocked:dns_private_ip');
      }
    }
    const res = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_LIMITS.timeoutMs),
      headers: { 'user-agent': 'VectorResearch/0.1 (+public business research)' },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error('redirect_without_location');
      current = new URL(location, current).toString();
      continue;
    }
    const length = Number(res.headers.get('content-length') ?? '0');
    if (length > FETCH_LIMITS.maxBytes) throw new Error('response_too_large');
    return res;
  }
  throw new Error('too_many_redirects');
}
