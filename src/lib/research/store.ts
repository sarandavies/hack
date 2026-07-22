// Run store: in-memory with file persistence so demo progress survives refresh and
// dev-server restarts. Live mode uses PostgreSQL (src/db/schema.ts); this store also
// backs local synthetic demo mode, which must work with no database configured.

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { FeedbackItem, FeedbackType, ResearchMode, StartupProfile } from '../types.js';
import { demoProfile, DEMO_URL } from '../../data/demo/tramline.js';

export interface RunRecord {
  id: string;
  url: string;
  mode: ResearchMode;
  demo: boolean;
  createdAt: string;
  profile: StartupProfile;
  feedback: FeedbackItem[];
}

interface StoreShape {
  runs: Map<string, RunRecord>;
}

const g = globalThis as unknown as { __vectorStore?: StoreShape };

const PERSIST_PATH = path.join(process.cwd(), '.vector-runs.json');
const persistEnabled = !process.env.VITEST && !process.env.VERCEL;

function load(): StoreShape {
  if (g.__vectorStore) return g.__vectorStore;
  const store: StoreShape = { runs: new Map() };
  if (persistEnabled) {
    try {
      const raw = fs.readFileSync(PERSIST_PATH, 'utf8');
      const parsed = JSON.parse(raw) as RunRecord[];
      for (const r of parsed) store.runs.set(r.id, r);
    } catch {
      // no persisted runs yet
    }
  }
  g.__vectorStore = store;
  return store;
}

function persist(store: StoreShape) {
  if (!persistEnabled) return;
  try {
    fs.writeFileSync(PERSIST_PATH, JSON.stringify([...store.runs.values()], null, 2));
  } catch {
    // persistence is best-effort in demo mode
  }
}

function reconstructDemoRun(id: string): RunRecord | undefined {
  const match = /^demo-(fast|thorough)-([a-f0-9]+)-[a-f0-9]+$/.exec(id);
  if (!match) return undefined;
  const timestamp = Number.parseInt(match[2] ?? '', 16);
  return {
    id,
    url: DEMO_URL,
    mode: match[1] as ResearchMode,
    demo: true,
    createdAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString(),
    profile: demoProfile,
    feedback: [],
  };
}

export function createRun(opts: {
  url: string;
  mode: ResearchMode;
  demo: boolean;
  profile: StartupProfile;
  startedAt?: string;
}): RunRecord {
  const store = load();
  const run: RunRecord = {
    id: opts.demo
      ? `demo-${opts.mode}-${Date.now().toString(16)}-${randomUUID().slice(0, 8)}`
      : randomUUID(),
    url: opts.url,
    mode: opts.mode,
    demo: opts.demo,
    createdAt: opts.startedAt ?? new Date().toISOString(),
    profile: opts.profile,
    feedback: [],
  };
  store.runs.set(run.id, run);
  persist(store);
  return run;
}

export function getRun(id: string): RunRecord | undefined {
  return load().runs.get(id) ?? reconstructDemoRun(id);
}

export function addFeedback(
  runId: string,
  candidateId: string,
  type: FeedbackType,
  reason?: string,
): FeedbackItem | undefined {
  const store = load();
  const run = store.runs.get(runId) ?? reconstructDemoRun(runId);
  if (!run) return undefined;
  if (!store.runs.has(runId)) store.runs.set(runId, run);
  const item: FeedbackItem = {
    id: randomUUID(),
    candidateId,
    type,
    reason,
    createdAt: new Date().toISOString(),
  };
  run.feedback.push(item);
  persist(store);
  return item;
}
