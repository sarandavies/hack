// Vector HTTP server — dependency-free (Node 22 built-ins only), because this build
// environment has no package-registry egress. Serves the UI, the polling API,
// founder feedback and server-side exports.

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

function send(res: http.ServerResponse, status: number, body: string, type: string, extra: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': type, ...SECURITY_HEADERS, ...extra });
  res.end(body);
}
const html = (res: http.ServerResponse, body: string, status = 200) =>
  send(res, status, body, 'text/html; charset=utf-8');
const json = (res: http.ServerResponse, body: unknown, status = 200) =>
  send(res, status, JSON.stringify(body), 'application/json; charset=utf-8');

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
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

export function createServer(): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
      const p = url.pathname;
      const method = req.method ?? 'GET';

      const staticFile = STATIC_FILES[p];
      if (staticFile && method === 'GET') {
        const content = fs.readFileSync(path.join(ROOT, staticFile.file), 'utf8');
        send(res, 200, content, staticFile.type, { 'cache-control': 'public, max-age=60' });
        return;
      }

      if (p === '/' && method === 'GET') return html(res, landingPage());
      if (p === '/methodology' && method === 'GET') return html(res, methodologyPage());

      if (p === '/analyse' && method === 'GET') {
        const target = url.searchParams.get('url') ?? DEMO_URL;
        let domain = '';
        try {
          domain = canonicalDomain(target);
        } catch {
          return html(res, analysePage(null, { demo: false, mode: 'fast', url: target, error: 'That does not look like a valid company website URL.' }), 400);
        }
        const demo = url.searchParams.get('demo') === '1' || domain === 'tramline.example';
        const mode = url.searchParams.get('mode') === 'thorough' ? 'thorough' : 'fast';
        if (demo) return html(res, analysePage(demoProfile, { demo: true, mode, url: DEMO_URL }));
        if (!liveResearchAvailable()) {
          return html(res, analysePage(null, { demo: false, mode, url: target, error: LIVE_UNAVAILABLE_MSG }), 200);
        }
        return html(res, analysePage(null, { demo: false, mode, url: target, error: 'Live provider credentials detected. In this build, live startup analysis runs through the evaluation harness (npm run eval:live); the in-app flow ships the synthetic demo.' }), 200);
      }

      if (p === '/runs/create' && method === 'POST') {
        const body = await readBody(req);
        const form = new URLSearchParams(body);
        const demo = form.get('demo') === '1';
        const mode: ResearchMode = form.get('mode') === 'thorough' ? 'thorough' : 'fast';
        if (!demo && !liveResearchAvailable()) {
          return html(res, analysePage(null, { demo: false, mode, url: form.get('url') ?? '', error: LIVE_UNAVAILABLE_MSG }), 422);
        }
        const run = createRun({ url: DEMO_URL, mode, demo: true, profile: profileFromForm(form) });
        res.writeHead(303, { location: `/runs/${run.id}`, ...SECURITY_HEADERS });
        res.end();
        return;
      }

      const runMatch = /^\/runs\/([a-f0-9-]{10,})$/.exec(p);
      if (runMatch && method === 'GET') {
        const run = getRun(runMatch[1] ?? '');
        if (!run) return html(res, landingPage(), 404);
        return html(res, runPage(buildRunView(run)));
      }

      // --- API ---
      if (p === '/api/profile' && method === 'POST') {
        const body = JSON.parse(await readBody(req)) as { url?: string; demo?: boolean };
        if (typeof body.url !== 'string' || body.url.length < 4 || body.url.length > 500) {
          return json(res, { error: 'invalid_request' }, 400);
        }
        let domain: string;
        try {
          domain = canonicalDomain(body.url);
        } catch {
          return json(res, { error: 'invalid_url' }, 400);
        }
        if (body.demo || domain === 'tramline.example') {
          return json(res, { demo: true, profile: demoProfile });
        }
        return json(res, { error: 'live_research_unavailable', message: LIVE_UNAVAILABLE_MSG }, 422);
      }

      if (p === '/api/runs' && method === 'POST') {
        const body = JSON.parse(await readBody(req)) as {
          url?: string;
          mode?: string;
          demo?: boolean;
          profile?: Partial<StartupProfile>;
        };
        if (typeof body.url !== 'string') return json(res, { error: 'invalid_request' }, 400);
        let domain: string;
        try {
          domain = canonicalDomain(body.url);
        } catch {
          return json(res, { error: 'invalid_url' }, 400);
        }
        const isDemo = Boolean(body.demo) || domain === 'tramline.example';
        if (!isDemo && !liveResearchAvailable()) {
          return json(res, { error: 'live_research_unavailable', message: LIVE_UNAVAILABLE_MSG }, 422);
        }
        if (!isDemo) {
          return json(res, { error: 'live_orchestrator_not_started', message: 'Live runs start via npm run eval:live in this build.' }, 501);
        }
        const profile: StartupProfile = { ...demoProfile, ...(body.profile ?? {}) };
        const run = createRun({ url: DEMO_URL, mode: body.mode === 'thorough' ? 'thorough' : 'fast', demo: true, profile });
        return json(res, { runId: run.id }, 201);
      }

      const apiRun = /^\/api\/runs\/([a-f0-9-]{10,})(\/(feedback|export))?$/.exec(p);
      if (apiRun) {
        const run = getRun(apiRun[1] ?? '');
        if (!run) return json(res, { error: 'run_not_found' }, 404);
        const sub = apiRun[3];
        if (!sub && method === 'GET') return json(res, buildRunView(run));
        if (sub === 'feedback' && method === 'POST') {
          const body = JSON.parse(await readBody(req)) as { candidateId?: string; type?: string; reason?: string };
          const types: FeedbackType[] = ['irrelevant', 'promising', 'exclude', 'note', 'competitor_incorrect', 'deeper_research'];
          if (
            typeof body.candidateId !== 'string' ||
            body.candidateId.length === 0 ||
            body.candidateId.length > 100 ||
            !types.includes(body.type as FeedbackType) ||
            (body.reason !== undefined && (typeof body.reason !== 'string' || body.reason.length > 1000))
          ) {
            return json(res, { error: 'invalid_request' }, 400);
          }
          addFeedback(run.id, body.candidateId, body.type as FeedbackType, body.reason);
          return json(res, buildRunView(run));
        }
        if (sub === 'export' && method === 'GET') {
          const format = url.searchParams.get('format') ?? 'targets';
          const view = buildRunView(run);
          if (!view.results) return json(res, { error: 'run_not_complete' }, 409);
          const builders: Record<string, { build: (v: typeof view) => string; ext: string; mime: string }> = {
            targets: { build: buildTargetsCsv, ext: 'csv', mime: 'text/csv' },
            universe: { build: buildUniverseCsv, ext: 'csv', mime: 'text/csv' },
            competitors: { build: buildCompetitorsCsv, ext: 'csv', mime: 'text/csv' },
            signals: { build: buildSignalsCsv, ext: 'csv', mime: 'text/csv' },
            report: { build: buildReportJson, ext: 'json', mime: 'application/json' },
            brief: { build: buildBriefMarkdown, ext: 'md', mime: 'text/markdown' },
          };
          const spec = builders[format];
          if (!spec) return json(res, { error: 'unknown_format' }, 400);
          const filename = sanitiseFilename(`vector-${view.profile.name}-${format}.${spec.ext}`);
          return send(res, 200, spec.build(view), `${spec.mime}; charset=utf-8`, {
            'content-disposition': `attachment; filename="${filename}"`,
          });
        }
      }

      return json(res, { error: 'not_found' }, 404);
    } catch (err) {
      if (err instanceof Error && err.message === 'body_too_large') {
        return json(res, { error: 'body_too_large' }, 413);
      }
      console.error('[vector] request error:', err instanceof Error ? err.message : err);
      return json(res, { error: 'internal_error' }, 500);
    }
  });
}

const isMain = process.argv[1]?.endsWith('main.ts');
if (isMain) {
  getEnv(); // validate environment on startup; demo mode needs no secrets
  createServer().listen(PORT, () => {
    console.log(`Vector running at http://localhost:${PORT} (demo: /analyse?demo=1)`);
  });
}
