import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessEmployment,
  canonicalDomain,
  canonicaliseUrl,
  companiesMatch,
  normaliseCompanyName,
} from '@/lib/entity-resolution';

const NOW = new Date('2026-07-22T00:00:00Z');

describe('URL canonicalisation', () => {
  it('normalises scheme, www, trailing slash and tracking params', () => {
    assert.equal(canonicaliseUrl('https://www.Example.com/path/?utm_source=x&b=2'), 'example.com/path?b=2');
    assert.equal(canonicaliseUrl('http://example.com'), 'example.com');
    assert.equal(canonicaliseUrl('example.com/'), 'example.com');
    assert.equal(canonicaliseUrl('https://example.com/?gclid=abc&fbclid=def'), 'example.com');
  });
  it('extracts the canonical domain', () => {
    assert.equal(canonicalDomain('https://www.tramline.example/product?utm_campaign=x'), 'tramline.example');
  });
});

describe('company name normalisation and matching', () => {
  it('strips corporate suffixes', () => {
    assert.equal(normaliseCompanyName('Halvard Logistics AS'), 'halvard logistics');
    assert.equal(normaliseCompanyName('Acme, Inc.'), 'acme');
    assert.equal(normaliseCompanyName('Kelpwater Marine Ltd'), 'kelpwater marine');
  });
  it('matches on canonical domain', () => {
    const r = companiesMatch(
      { name: 'Acme', domain: 'https://www.acme.com/' },
      { name: 'Acme Corporation', domain: 'acme.com' },
    );
    assert.equal(r.match, true);
    assert.equal(r.confident, true);
  });
  it('never merges on similar name alone', () => {
    const r = companiesMatch({ name: 'Kelpwater Marine Ltd' }, { name: 'Kelpwater Marine' });
    assert.equal(r.match, false);
    assert.equal(r.reason, 'name_only_requires_corroboration');
  });
  it('different domains means different companies even with the same name', () => {
    const r = companiesMatch(
      { name: 'Kelpwater', domain: 'kelpwater.example' },
      { name: 'Kelpwater', domain: 'kelpwater-systems.example' },
    );
    assert.equal(r.match, false);
  });
});

describe('employment currency', () => {
  it('recent evidence is current', () => {
    assert.equal(assessEmployment({ evidenceDate: '2026-05-18', now: NOW }), 'current_verified');
  });
  it('year-plus-old evidence is uncertain', () => {
    assert.equal(assessEmployment({ evidenceDate: '2024-09-10', now: NOW }), 'uncertain');
  });
  it('multi-year-old biographies are stale — never proof of current employment', () => {
    assert.equal(assessEmployment({ evidenceDate: '2022-01-01', now: NOW }), 'stale');
  });
  it('conflicting evidence is surfaced as conflicting', () => {
    assert.equal(assessEmployment({ evidenceDate: '2026-06-01', now: NOW, conflicting: true }), 'conflicting');
  });
});
