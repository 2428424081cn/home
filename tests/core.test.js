import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SHORTCUTS, MAX_SHORTCUTS, STORAGE_KEY,
  loadPreferences, normalizeWebsiteUrl, resolveSearchTarget, savePreferences, validatePreferences,
} from '../src/core.js';

test('search preserves Chinese and reserved characters across all engines', () => {
  const text = '猫 & 狗 # ? / + % = 空格';
  const expected = [
    ['Google', 'www.google.com', 'q'], ['Bing', 'www.bing.com', 'q'], ['百度', 'www.baidu.com', 'wd'],
  ];
  for (const [engine, hostname, parameter] of expected) {
    const url = new URL(resolveSearchTarget(`  ${text}  `, engine));
    assert.equal(url.hostname, hostname);
    assert.equal(url.searchParams.get(parameter), text);
    assert.equal([...url.searchParams].length, 1);
    assert.equal(url.hash, '');
  }
  assert.equal(resolveSearchTarget('  '), null);
});

test('addresses navigate with paths, ports and fragments intact', () => {
  const cases = [
    ['example.com', 'https://example.com/'],
    ['example.com:8443/path?q=abc#one', 'https://example.com:8443/path?q=abc#one'],
    ['https://example.com/a?q=2#part', 'https://example.com/a?q=2#part'],
    ['http://example.com/', 'http://example.com/'],
    ['localhost:3000/dev', 'http://localhost:3000/dev'],
    ['127.0.0.1:8080/', 'http://127.0.0.1:8080/'],
    ['192.168.1.10/test', 'http://192.168.1.10/test'],
    ['https://例子.中国/', 'https://xn--fsqu00a.xn--fiqs8s/'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(normalizeWebsiteUrl(input), expected);
    assert.equal(resolveSearchTarget(input), expected);
  }
  assert.equal(normalizeWebsiteUrl('127.1'), null);
  assert.equal(normalizeWebsiteUrl('256.0.0.1'), null);
  assert.equal(normalizeWebsiteUrl('a sentence'), null);
  assert.equal(normalizeWebsiteUrl('localhost:99999'), null);
});

test('unsafe protocols and concealed credentials are rejected and become escaped search terms', () => {
  const cases = [
    'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd', 'vbscript:msgbox(1)', 'https://user:secret@example.com/',
    'https://example.com\\@evil.com', 'java\nscript:alert(1)', 'https:example.com',
  ];
  for (const input of cases) {
    assert.equal(normalizeWebsiteUrl(input), null);
    const result = new URL(resolveSearchTarget(input));
    assert.equal(result.protocol, 'https:');
    assert.equal(result.hostname, 'www.google.com');
    assert.equal(result.searchParams.get('q'), input.trim());
  }
});

test('preferences recover usable entries without trusting malformed storage', () => {
  assert.equal(validatePreferences({ version: 2, theme: 'dark', shortcuts: [] }).theme, 'light');
  const value = validatePreferences({
    version: 1, theme: 'dark', engine: 'Bing',
    shortcuts: [
      { id: 'one', name: ' 测试 ', url: 'example.com' },
      { id: 'one', name: '重复', url: 'https://other.com' },
      { id: 'two', name: '<img onerror=alert(1)>', url: 'javascript:alert(1)' },
      { id: '__bad spaces__', name: '名称', url: 'https://example.com' },
    ],
  });
  assert.equal(value.theme, 'dark');
  assert.equal(value.engine, 'Bing');
  assert.deepEqual(value.shortcuts, [{ id: 'one', name: '测试', url: 'https://example.com/' }]);
  assert.deepEqual(validatePreferences({ version: 1, shortcuts: [] }).shortcuts, []);
  assert.equal(validatePreferences({ version: 1, shortcuts: [{ url: 'javascript:1' }] }).shortcuts.length, DEFAULT_SHORTCUTS.length);
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `id-${i}`, name: `链接${i}`, url: 'https://example.com' }));
  assert.equal(validatePreferences({ version: 1, shortcuts: many }).shortcuts.length, MAX_SHORTCUTS);
});

test('storage survives corrupt JSON and unavailable read or write operations', () => {
  assert.equal(loadPreferences({ getItem: () => '{broken' }).status, 'corrupt');
  assert.equal(loadPreferences({ getItem: () => null }).status, 'empty');
  assert.equal(loadPreferences({ getItem: () => { throw new Error('blocked'); } }).status, 'unavailable');
  assert.equal(savePreferences({ setItem: () => { throw new Error('quota'); } }, validatePreferences(null)), false);
  assert.equal(savePreferences(null, validatePreferences(null)), false);
  const memory = new Map();
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const preferences = validatePreferences({ version: 1, theme: 'paper', engine: '百度', shortcuts: [] });
  assert.equal(savePreferences(storage, preferences), true);
  assert.equal(JSON.parse(memory.get(STORAGE_KEY)).version, 1);
  assert.deepEqual(loadPreferences(storage), { preferences, status: 'ok' });
});
