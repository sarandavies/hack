import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, sanitiseFilename, toCsv } from '@/lib/exports/csv';

describe('CSV escaping', () => {
  it('passes plain values through', () => {
    assert.equal(csvCell('hello'), 'hello');
    assert.equal(csvCell(42), '42');
    assert.equal(csvCell(undefined), '');
  });
  it('quotes commas, quotes and newlines', () => {
    assert.equal(csvCell('a,b'), '"a,b"');
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell('line1\nline2'), '"line1\nline2"');
  });
  it('neutralises spreadsheet formula injection', () => {
    assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)");
    assert.equal(csvCell('+1'), "'+1");
    assert.equal(csvCell('-1'), "'-1");
    assert.equal(csvCell('@cmd'), "'@cmd");
  });
  it('builds rows with trailing newline', () => {
    assert.equal(toCsv([['a', 'b'], ['c,d', 'e']]), 'a,b\n"c,d",e\n');
  });
});

describe('filename sanitisation', () => {
  it('strips unsafe characters', () => {
    assert.equal(sanitiseFilename('vector-Acme, Inc/../etc.csv'), 'vector-Acme-Inc-..-etc.csv');
    assert.ok(!sanitiseFilename('a/b\\c"d.csv').includes('/'));
  });
});
