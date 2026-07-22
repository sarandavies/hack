import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIpv4, validateFetchUrl } from '@/lib/security/ssrf';

describe('SSRF URL validation', () => {
  const blocked = [
    'http://localhost/admin',
    'http://sub.localhost/x',
    'https://127.0.0.1/',
    'http://10.1.2.3/x',
    'http://172.16.0.1/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://0.0.0.0/',
    'http://100.64.0.1/',
    'ftp://example.com/file',
    'file:///etc/passwd',
    'gopher://example.com/',
    'http://internal.service.internal/',
    'http://[::1]/',
  ];
  for (const url of blocked) {
    it(`blocks ${url}`, () => {
      assert.equal(validateFetchUrl(url).ok, false);
    });
  }
  const allowed = ['https://example.com/page', 'http://news.example.org/a?b=1', 'https://8.8.8.8/'];
  for (const url of allowed) {
    it(`allows ${url}`, () => {
      assert.equal(validateFetchUrl(url).ok, true);
    });
  }
  it('rejects malformed urls', () => {
    assert.equal(validateFetchUrl('not a url').ok, false);
  });
});

describe('private IPv4 ranges', () => {
  it('classifies ranges correctly', () => {
    assert.equal(isPrivateIpv4('10.0.0.1'), true);
    assert.equal(isPrivateIpv4('172.31.255.255'), true);
    assert.equal(isPrivateIpv4('172.32.0.1'), false);
    assert.equal(isPrivateIpv4('192.168.0.5'), true);
    assert.equal(isPrivateIpv4('169.254.169.254'), true);
    assert.equal(isPrivateIpv4('8.8.8.8'), false);
    assert.equal(isPrivateIpv4('224.0.0.1'), true);
  });
});
