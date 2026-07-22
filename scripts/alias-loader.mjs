// Resolves the "@/..." tsconfig path alias for Node ESM (tsx does not resolve paths).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = path.resolve(process.cwd(), 'src');

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const base = path.join(SRC, specifier.slice(2));
    const candidates = [base + '.ts', base + '.tsx', path.join(base, 'index.ts'), base];
    const found = candidates.find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
    if (found) return nextResolve(pathToFileURL(found).href, context);
  }
  return nextResolve(specifier, context);
}
