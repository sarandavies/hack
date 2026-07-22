// Vector request handler. The same Web-standard handler runs locally and as a
// Vercel Function, so deployment does not depend on a long-running HTTP server.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getEnv, liveResearchAvailable } from '@/config/env';
import { canonicalDomain } from '@/lib/entity-resolution';
import { addFeedback, createRun, getRun } from '@/lib/research/store';
import { buildRunView } from '@/lib/research/run-view';
import { demoProfile, DEMO_URL } from '@/data/demo/tramline';
import type { FeedbackType, ResearchMode, StartupProfile } from '@/lib/types';
import {
  buildBriefMarkdown,
  buildCompetitorsCsv,
  buildReportJson,
  buildSignalsCsv,
  buildTargetsCsv,
  buildUniverseCsv,
  sanitiseFilename,
} from '@/lib/exports/csv';
import { analysePage, landingPage, methodologyPage, runPage } from './render';

const PORT = Number(process.env.PORT ?? 3000);
const MAX_BODY = 200_000;
const ROOT = process.cwd();

const SECURITY_HEADERS: Record<string, string> = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
};

function response(
  status: number,
  body: string,
  type: string,
  extra: Record<string, string> = {},
): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': type, ...SECURITY_HEADERS, ...extra },
  });
}

const html = (body: string, status = 200) => response(status, body, 'text/html; charset=utf-8');
const json = (body: unknown, status = 200) =>
  response(status, JSON.stringify(body), 'application/json; charset=utf-8');

async function readBody(request: Request): Promise<string> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY) throw new Error('body_too_large');
  const body = await request.text();
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY) throw new Error('body_too_large');
  return body;
}

const LIVE_UNAVAILABLE_MSG =
  'Analysing a real URL requires live credentials (ANTHROPIC_API_KEY plus EXA_API_KEY or BRAVE_SEARCH_API_KEY) and LIVE_RESEARCH_ENABLED=true. Vector never fabricates a profile or evidence for a real company — synthetic and live data are never mixed. Try the synthetic Tramline demo instead.';

function profileFromForm(form: URLSearchParams): StartupProfile {
  const edited: Record<string, unknown> = {};
  for (const [key, original] of Object.entries(demoProfile)) {
    const raw = form.get(`pf_${key}`);
    if (raw === null) {
      edited[key] = original;
    } else if (Array.isArray(original)) {
      edited[key] = raw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      edited[key] = raw.trim();
    }
  }
  return edited as unknown as StartupProfile;
}

const STATIC_FILES: Record<string, { file: string; type: string }> = {
  '/public/styles.css': { file: 'public/styles.css', type: 'text/css; charset=utf-8' },
  '/public/app.js': { file: 'public/app.js', type: 'text/javascript; charset=utf-8' },
};

export async function handleRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const p = url.pathname;
    const method = request.method;

    const staticFile = STATIC_FILES[p];
    if (staticFile && method === 'GET') {
      const content = fs.readFileSync(path.join(ROOT, staticFile.file), 'utf8');
      return response(200, content, staticFile.type, { 'cache-control': 'public, max-age=60' });
    }

    if (p === '/' && method === 'GET') return html(landingPage());
    if (p === '/methodology' && method === 'GET') return html(methodologyPage());

    if (p === '/analyse' && method === 'GET') {
      const target = url.searchParams.get('url') ?? DEMO_URL;
      let domain = '';
      try {
        domain = canonicalDomain(target);
      } catch {
        return html(
          analysePage(null, {
            demo: false,
            mode: 'fast',
            url: target,
            error: 'That does not look like a valid company website URL.',
          }),
          400,
        );
      }
      const demo = url.searchParams.get('demo') === '1' || domain === 'tramline.example';
      const mode = url.searchParams.get('mode') === 'thorough' ? 'thorough' : 'fast';
      if (demo) return html(analysePage(demoProfile, { demo: true, mode, url: DEMO_URL }));
      if (!liveResearchAvailable()) {
        return html(
          analysePage(null, { demo: false, mode, url: target, error: LIVE_UNAVAILABLE_MSG }),
        );
      }
      return html(
        analysePage(null, {
          demo: false,
          mode,
          url: target,
          error:
            'Live provider credentials detected. In this build, live startup analysis runs through the evaluation harness (npm run eval:live); the in-app flow ships the synthetic demo.',
        }),
      );
    }

    if (p === '/runs/create' && method === 'POST') {
      const form = new URLSearchParams(await readBody(request));
      const demo = form.get('demo') === '1';
      const mode: ResearchMode = form.get('mode') === 'thorough' ? 'thorough' : 'fast';
      if (!demo && !liveResearchAvailable()) {
        return html(
          analysePage(null, {
            demo: false,
            mode,
            url: form.get('url') ?? '',
            error: LIVE_UNAVAILABLE_MSG,
          }),
          422,
        );
      }
      const run = createRun({
        url: DEMO_URL,
        mode,
        demo: true,
        profile: profileFromForm(form),
      });
      return response(303, '', 'text/plain; charset=utf-8', { location: `/runs/${run.id}` });
    }

    const runMatch = /^\/runs\/([a-z0-9-]{10,})$/.exec(p);
    if (runMatch && method === 'GET') {
      const run = getRun(runMatch[1] ?? '');
      if (!run) return html(landingPage(), 404);
      return html(runPage(buildRunView(run)));
    }

    if (p === '/api/profile' && method === 'POST') {
      const body = JSON.parse(await readBody(request)) as { url?: string; demo?: boolean };
      if (typeof body.url !== 'string' || body.url.length < 4 || body.url.length > 500) {
        return json({ error: 'invalid_request' }, 400);
      }
      let domain: string;
      try {
        domain = canonicalDomain(body.url);
      } catch {
        return json({ error: 'invalid_url' }, 400);
      }
      if (body.demo || domain === 'tramline.example') {
        return json({ demo: true, profile: demoProfile });
      }
      return json({ error: 'live_research_unavailable', message: LIVE_UNAVAILABLE_MSG }, 422);
    }

    if (p === '/api/runs' && method === 'POST') {
      const body = JSON.parse(await readBody(request)) as {
        url?: string;
        mode?: string;
        demo?: boolean;
        profile?: Partial<StartupProfile>;
      };
      if (typeof body.url !== 'string') return json({ error: 'invalid_request' }, 400);
      let domain: string;
      try {
        domain = canonicalDomain(body.url);
      } catch {
        return json({ error: 'invalid_url' }, 400);
      }
      const isDemo = Boolean(body.demo) || domain === 'tramline.example';
      if (!isDemo && !liveResearchAvailable()) {
        return json({ error: 'live_research_unavailable', message: LIVE_UNAVAILABLE_MSG }, 422);
      }
      if (!isDemo) {
        return json(
          {
            error: 'live_orchestrator_not_started',
            message: 'Live runs start via npm run eval:live in this build.',
          },
          501,
        );
      }
      const profile: StartupProfile = { ...demoProfile, ...(body.profile ?? {}) };
      const run = createRun({
        url: DEMO_URL,
        mode: body.mode === 'thorough' ? 'thorough' : 'fast',
        demo: true,
        profile,
      });
      return json({ runId: run.id }, 201);
    }

    const apiRun = /^\/api\/runs\/([a-z0-9-]{10,})(\/(feedback|export))?$/.exec(p);
    if (apiRun) {
      const run = getRun(apiRun[1] ?? '');
      if (!run) return json({ error: 'run_not_found' }, 404);
      const sub = apiRun[3];
      if (!sub && method === 'GET') return json(buildRunView(run));
      if (sub === 'feedback' && method === 'POST') {
        const body = JSON.parse(await readBody(request)) as {
          candidateId?: string;
          type?: string;
          reason?: string;
        };
        const types: FeedbackType[] = [
          'irrelevant',
          'promising',
          'exclude',
          'note',
          'competitor_incorrect',
          'deeper_research',
        ];
        if (
          typeof body.candidateId !== 'string' ||
          body.candidateId.length === 0 ||
          body.candidateId.length > 100 ||
          !types.includes(body.type as FeedbackType) ||
          (body.reason !== undefined &&
            (typeof body.reason !== 'string' || body.reason.length > 1000))
        ) {
          return json({ error: 'invalid_request' }, 400);
        }
        addFeedback(run.id, body.candidateId, body.type as FeedbackType, body.reason);
        return json(buildRunView(run));
      }
      if (sub === 'export' && method === 'GET') {
        const format = url.searchParams.get('format') ?? 'targets';
        const view = buildRunView(run);
        if (!view.results) return json({ error: 'run_not_complete' }, 409);
        const builders: Record<
          string,
          { build: (v: typeof view) => string; ext: string; mime: string }
        > = {
          targets: { build: buildTargetsCsv, ext: 'csv', mime: 'text/csv' },
          universe: { build: buildUniverseCsv, ext: 'csv', mime: 'text/csv' },
          competitors: { build: buildCompetitorsCsv, ext: 'csv', mime: 'text/csv' },
          signals: { build: buildSignalsCsv, ext: 'csv', mime: 'text/csv' },
          report: { build: buildReportJson, ext: 'json', mime: 'application/json' },
          brief: { build: buildBriefMarkdown, ext: 'md', mime: 'text/markdown' },
        };
        const spec = builders[format];
        if (!spec) return json({ error: 'unknown_format' }, 400);
        const filename = sanitiseFilename(`vector-${view.profile.name}-${format}.${spec.ext}`);
        return response(200, spec.build(view), `${spec.mime}; charset=utf-8`, {
          'content-disposition': `attachment; filename="${filename}"`,
        });
      }
    }

    return json({ error: 'not_found' }, 404);
  } catch (err) {
    if (err instanceof Error && err.message === 'body_too_large') {
      return json({ error: 'body_too_large' }, 413);
    }
    console.error('[vector] request error:', err instanceof Error ? err.message : err);
    return json({ error: 'internal_error' }, 500);
  }
}

async function readNodeBody(req: http.IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY) throw new Error('body_too_large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export function createServer(): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
        else if (value !== undefined) headers.set(key, value);
      }
      const body = await readNodeBody(req);
      const request = new Request(
        new URL(req.url ?? '/', `http://${req.headers.host ?? `localhost:${PORT}`}`),
        {
          method: req.method,
          headers,
          body,
        },
      );
      const result = await handleRequest(request);
      const outHeaders: Record<string, string> = {};
      result.headers.forEach((value, key) => {
        outHeaders[key] = value;
      });
      res.writeHead(result.status, outHeaders);
      res.end(Buffer.from(await result.arrayBuffer()));
    } catch (err) {
      console.error('[vector] local adapter error:', err instanceof Error ? err.message : err);
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal_error' }));
    }
  });
}

const isMain = process.argv[1]?.endsWith('main.ts');
if (isMain) {
  getEnv();
  createServer().listen(PORT, () => {
    console.log(`Vector running at http://localhost:${PORT} (demo: /analyse?demo=1)`);
  });
}
