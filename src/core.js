export const STORAGE_KEY = 'qidian.preferences.v1';
export const MAX_SHORTCUTS = 18;
export const SEARCH_ENGINES = Object.freeze({
  Google: { endpoint: 'https://www.google.com/search', parameter: 'q', letter: 'G', color: '#4285f4' },
  Bing: { endpoint: 'https://www.bing.com/search', parameter: 'q', letter: 'b', color: '#48a5a5' },
  百度: { endpoint: 'https://www.baidu.com/s', parameter: 'wd', letter: '度', color: '#587fe0' },
});
export const DEFAULT_SHORTCUTS = Object.freeze([
  { id: 'google', name: 'Google', url: 'https://www.google.com/' },
  { id: 'bilibili', name: '哔哩哔哩', url: 'https://www.bilibili.com/' },
  { id: 'github', name: 'GitHub', url: 'https://github.com/' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { id: 'notion', name: 'Notion', url: 'https://www.notion.so/' },
]);

function makeDefaults() {
  return { version: 1, theme: 'light', engine: 'Google', shortcuts: DEFAULT_SHORTCUTS.map(item => ({ ...item })) };
}

function isIPv4(hostname) {
  const parts = hostname.split('.');
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function isDomain(hostname) {
  const labels = hostname.replace(/\.$/, '').split('.');
  if (labels.length < 2 || hostname.length > 253) return false;
  const last = labels.at(-1);
  return labels.every(label => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))
    && (/^[a-z]{2,63}$/i.test(last) || /^xn--[a-z\d-]+$/i.test(last));
}

/** Accept web URLs and recognizable hostnames; return null for text and unsafe schemes. */
export function normalizeWebsiteUrl(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input || input.length > 4096 || /[\s\u0000-\u001f\u007f\\]/u.test(input)) return null;

  const explicit = /^https?:\/\//i.test(input);
  const protocolRelative = input.startsWith('//');
  const localHostWithPort = /^localhost(?::\d{1,5})?(?:[/?#]|$)/i.test(input);
  // Treat a host followed by a port as an address; every other explicit scheme is rejected.
  if (!explicit && !protocolRelative && /^[a-z][a-z\d+.-]*:/i.test(input) && !localHostWithPort) {
    if (!/^[a-z\d.-]+:\d{1,5}(?:[/?#]|$)/i.test(input)) return null;
  }

  try {
    const rawHost = input.replace(/^https?:\/\//i, '').replace(/^\/\//, '').split(/[/?#]/, 1)[0];
    const bareHost = rawHost.replace(/:\d+$/, '');
    const local = bareHost.toLowerCase() === 'localhost' || isIPv4(bareHost);
    const url = new URL(explicit ? input : protocolRelative ? `https:${input}` : `${local ? 'http' : 'https'}://${input}`);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    if (!explicit && !protocolRelative && !local && !isDomain(url.hostname)) return null;
    // A numeric address must contain all four octets, even when URL() accepts a shorthand.
    if (/^[\d.]+$/.test(bareHost) && !isIPv4(bareHost)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function resolveSearchTarget(value, engine = 'Google') {
  if (typeof value !== 'string' || !value.trim()) return null;
  const input = value.trim();
  const website = normalizeWebsiteUrl(input);
  if (website) return website;
  const selected = SEARCH_ENGINES[engine] ?? SEARCH_ENGINES.Google;
  const url = new URL(selected.endpoint);
  url.searchParams.set(selected.parameter, input);
  return url.href;
}

function cleanShortcut(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  if (typeof item.id !== 'string' || !/^[a-z\d_-]{1,64}$/i.test(item.id)) return null;
  if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 32) return null;
  const url = normalizeWebsiteUrl(item.url);
  if (!url) return null;
  return { id: item.id, name: item.name.trim(), url };
}

/** Recover valid fields from old or damaged browser storage, with safe defaults. */
export function validatePreferences(value) {
  const defaults = makeDefaults();
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) return defaults;
  const theme = ['light', 'paper', 'dark'].includes(value.theme) ? value.theme : defaults.theme;
  const engine = Object.hasOwn(SEARCH_ENGINES, value.engine) ? value.engine : defaults.engine;
  let shortcuts = defaults.shortcuts;
  if (Array.isArray(value.shortcuts)) {
    const seen = new Set();
    const valid = value.shortcuts.map(cleanShortcut).filter(item => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).slice(0, MAX_SHORTCUTS);
    shortcuts = value.shortcuts.length === 0 || valid.length > 0 ? valid : defaults.shortcuts;
  }
  return { version: 1, theme, engine, shortcuts };
}

export function loadPreferences(storage) {
  try {
    if (!storage || typeof storage.getItem !== 'function') return { preferences: makeDefaults(), status: 'unavailable' };
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { preferences: makeDefaults(), status: 'empty' };
    const value = JSON.parse(raw);
    const preferences = validatePreferences(value);
    const valid = value?.version === 1
      && ['light', 'paper', 'dark'].includes(value.theme)
      && Object.hasOwn(SEARCH_ENGINES, value.engine)
      && Array.isArray(value.shortcuts)
      && value.shortcuts.length <= MAX_SHORTCUTS
      && value.shortcuts.every(item => cleanShortcut(item))
      && new Set(value.shortcuts.map(item => item.id)).size === value.shortcuts.length;
    return { preferences, status: valid ? 'ok' : 'corrupt' };
  } catch (error) {
    return { preferences: makeDefaults(), status: error instanceof SyntaxError ? 'corrupt' : 'unavailable' };
  }
}

export function savePreferences(storage, preferences) {
  try {
    if (!storage || typeof storage.setItem !== 'function') return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(validatePreferences(preferences)));
    return true;
  } catch {
    return false;
  }
}

export function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5 || hour >= 23) return '夜深了，给自己一点休息';
  if (hour < 9) return '早上好，迎接新的灵感';
  if (hour < 12) return '上午好，开启今天的好奇心';
  if (hour < 14) return '中午好，留一点时间给自己';
  if (hour < 18) return '下午好，让灵感慢慢发生';
  return '晚上好，享受此刻的安静';
}
