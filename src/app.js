import {
  DEFAULT_SHORTCUTS, MAX_SHORTCUTS, SEARCH_ENGINES, STORAGE_KEY,
  getGreeting, loadPreferences, normalizeWebsiteUrl, resolveSearchTarget, savePreferences,
} from './core.js';

const root = document.documentElement;
const appearance = document.getElementById('appearance');
const engineToggle = document.getElementById('engine-toggle');
const engineMenu = document.getElementById('engine-menu');
const engineChoices = Array.from(document.querySelectorAll('[data-engine]'));
const searchInput = document.getElementById('search-input');
const shortcuts = document.querySelector('.shortcuts');
const shortcutDialog = document.getElementById('shortcut-dialog');
const shortcutForm = document.getElementById('shortcut-form');
const nameInput = document.getElementById('shortcut-name');
const urlInput = document.getElementById('shortcut-url');
const shortcutError = document.getElementById('shortcut-error');
const deleteButton = document.getElementById('delete-shortcut');
const statusMessage = document.getElementById('status-message');
const iconTemplates = new Map();

for (const link of shortcuts.querySelectorAll('a.shortcut')) {
  const icon = link.querySelector('.shortcut-icon');
  const item = DEFAULT_SHORTCUTS.find(item => item.url === link.href);
  if (item && icon) iconTemplates.set(item.id, icon.cloneNode(true));
}
const addTemplate = shortcuts.querySelector('button.add')?.cloneNode(true);
let storage;
try { storage = window.localStorage; } catch { storage = null; }
const loaded = loadPreferences(storage);
let preferences = loaded.preferences;
let editingId = null;
let dialogTrigger = null;
let statusTimer;

function showStatus(message) {
  clearTimeout(statusTimer);
  statusMessage.textContent = message;
  statusMessage.classList.add('is-visible');
  statusTimer = setTimeout(() => statusMessage.classList.remove('is-visible'), 4000);
}

function persist(successMessage) {
  const saved = savePreferences(storage, preferences);
  if (!saved) showStatus('设置已应用。浏览器暂时无法保存，刷新后会恢复默认设置。');
  else if (successMessage) showStatus(successMessage);
  return saved;
}

function updateClock() {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const clock = document.querySelector('.clock');
  const text = `${hour}:${minute}`;
  if (clock.textContent !== text) {
    clock.textContent = text;
    clock.setAttribute('aria-label', `${now.getHours()}点${now.getMinutes()}分`);
  }
  const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(now);
  document.querySelector('.date').textContent = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 · ${weekday}`;
  document.querySelector('.date-mini').textContent = `${now.getMonth() + 1}月${now.getDate()}日 · ${weekday}`;
  document.getElementById('greeting-text').textContent = getGreeting(now);
  document.querySelector('.greeting use')?.setAttribute('href', now.getHours() >= 18 || now.getHours() < 5 ? '#moon' : '#sun');
}

function applyTheme(theme) {
  preferences.theme = theme;
  root.dataset.theme = theme;
  document.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme)));
  const dark = theme === 'dark';
  document.querySelector('#theme-toggle use').setAttribute('href', dark ? '#sun' : '#moon');
  const toggle = document.getElementById('theme-toggle');
  toggle.setAttribute('aria-label', dark ? '切换浅色外观' : '切换深色外观');
  toggle.title = dark ? '切换浅色外观' : '切换深色外观';
}

function applyEngine(engine) {
  preferences.engine = engine;
  const selected = SEARCH_ENGINES[engine];
  document.getElementById('engine-name').textContent = engine;
  const letter = document.querySelector('.engine-letter');
  letter.textContent = selected.letter;
  letter.style.color = selected.color;
  engineToggle.setAttribute('aria-label', `选择搜索引擎，当前 ${engine}`);
  engineMenu.setAttribute('role', 'menu');
  engineChoices.forEach(button => {
    button.setAttribute('role', 'menuitemradio');
    button.setAttribute('aria-checked', String(button.dataset.engine === engine));
    button.querySelector('small')?.remove();
    if (button.dataset.engine === engine) {
      const mark = document.createElement('small');
      mark.textContent = '当前';
      button.append(mark);
    }
  });
}

function closeEngineMenu(restoreFocus = false) {
  const wasOpen = !engineMenu.hidden;
  engineMenu.hidden = true;
  engineToggle.setAttribute('aria-expanded', 'false');
  if (wasOpen && restoreFocus) engineToggle.focus();
}

function openEngineMenu() {
  engineMenu.hidden = false;
  engineToggle.setAttribute('aria-expanded', 'true');
  engineChoices.find(button => button.dataset.engine === preferences.engine)?.focus();
}

function renderShortcuts() {
  const fragment = document.createDocumentFragment();
  for (const item of preferences.shortcuts) {
    const wrapper = document.createElement('div');
    wrapper.className = 'shortcut-item';
    const link = document.createElement('a');
    link.className = 'shortcut';
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = `${item.name} · ${new URL(item.url).hostname}`;
    let icon = iconTemplates.get(item.id)?.cloneNode(true);
    if (!icon) {
      icon = document.createElement('span');
      icon.className = 'shortcut-icon custom-icon';
      icon.textContent = Array.from(item.name)[0].toUpperCase();
    }
    icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'shortcut-label';
    label.textContent = item.name;
    link.append(icon, label);
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'shortcut-edit';
    edit.dataset.editShortcut = item.id;
    edit.textContent = '⋯';
    edit.title = `编辑 ${item.name}`;
    edit.setAttribute('aria-label', `编辑 ${item.name}`);
    wrapper.append(link, edit);
    fragment.append(wrapper);
  }
  const add = addTemplate?.cloneNode(true) ?? document.createElement('button');
  add.type = 'button';
  add.className = 'shortcut add';
  if (!addTemplate) add.textContent = '+ 添加快捷方式';
  add.disabled = preferences.shortcuts.length >= MAX_SHORTCUTS;
  add.title = add.disabled ? `最多添加 ${MAX_SHORTCUTS} 个快捷方式` : '添加快捷方式';
  fragment.append(add);
  shortcuts.replaceChildren(fragment);
}

function showShortcutError(message) {
  shortcutError.textContent = message;
  shortcutError.hidden = false;
}

function openShortcutDialog(id, trigger) {
  const item = preferences.shortcuts.find(item => item.id === id);
  if (!item && preferences.shortcuts.length >= MAX_SHORTCUTS) {
    showStatus(`最多添加 ${MAX_SHORTCUTS} 个快捷方式。`);
    return;
  }
  editingId = item?.id ?? null;
  dialogTrigger = trigger;
  shortcutForm.reset();
  nameInput.value = item?.name ?? '';
  urlInput.value = item?.url ?? '';
  shortcutError.hidden = true;
  shortcutError.textContent = '';
  deleteButton.hidden = !item;
  document.getElementById('shortcut-title').textContent = item ? '编辑快捷方式' : '添加快捷方式';
  shortcutDialog.showModal();
  nameInput.focus();
}

function makeShortcutId() {
  return window.crypto?.randomUUID?.() ?? `shortcut-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  applyTheme(preferences.theme === 'dark' ? 'light' : 'dark');
  persist();
});
document.querySelectorAll('[data-open-settings]').forEach(button => button.addEventListener('click', () => {
  closeEngineMenu();
  appearance.showModal();
}));
document.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => {
  applyTheme(button.dataset.themeChoice);
  persist();
}));
document.getElementById('close-settings').addEventListener('click', () => appearance.close());
document.getElementById('done-settings').addEventListener('click', () => appearance.close());
document.getElementById('close-shortcut').addEventListener('click', () => shortcutDialog.close());

for (const dialog of [appearance, shortcutDialog]) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}
shortcutDialog.addEventListener('close', () => {
  if (dialogTrigger?.isConnected) dialogTrigger.focus();
  else {
    const replacement = [...shortcuts.querySelectorAll('[data-edit-shortcut]')].find(button => button.dataset.editShortcut === editingId);
    (replacement ?? shortcuts.querySelector('.add'))?.focus();
  }
});

engineToggle.addEventListener('click', () => engineMenu.hidden ? openEngineMenu() : closeEngineMenu());
engineToggle.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    openEngineMenu();
  }
});
engineChoices.forEach(button => button.addEventListener('click', () => {
  applyEngine(button.dataset.engine);
  persist();
  closeEngineMenu();
  searchInput.focus();
}));
engineMenu.addEventListener('keydown', event => {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = engineChoices.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? engineChoices.length - 1
    : (index + (event.key === 'ArrowDown' ? 1 : -1) + engineChoices.length) % engineChoices.length;
  engineChoices[next].focus();
});
engineMenu.addEventListener('focusout', event => {
  if (engineMenu.contains(event.relatedTarget) || event.relatedTarget === engineToggle) return;
  // Focus can briefly return to the document while a pointer moves between menu choices.
  // Wait for the next task so the focused button can receive its click before closing.
  setTimeout(() => {
    if (!engineMenu.contains(document.activeElement) && document.activeElement !== engineToggle) closeEngineMenu();
  }, 0);
});
document.addEventListener('click', event => {
  if (!event.target.closest('.search-wrap')) closeEngineMenu();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (shortcutDialog.open) shortcutDialog.close();
    else if (appearance.open) appearance.close();
    else closeEngineMenu(true);
  }
  const active = document.activeElement;
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey
    && !appearance.open && !shortcutDialog.open
    && !['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) && !active.isContentEditable) {
    event.preventDefault();
    closeEngineMenu();
    searchInput.focus();
  }
});

document.querySelector('.search').addEventListener('submit', event => {
  event.preventDefault();
  const target = resolveSearchTarget(searchInput.value, preferences.engine);
  if (!target) {
    searchInput.focus();
    return;
  }
  window.location.assign(target);
});

shortcuts.addEventListener('click', event => {
  const edit = event.target.closest('[data-edit-shortcut]');
  if (edit) openShortcutDialog(edit.dataset.editShortcut, edit);
  const add = event.target.closest('.add');
  if (add && !add.disabled) openShortcutDialog(null, add);
});

shortcutForm.addEventListener('submit', event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const url = normalizeWebsiteUrl(urlInput.value);
  if (!name || name.length > 32) {
    showShortcutError('请输入 1 至 32 个字符的网站名称。');
    nameInput.focus();
    return;
  }
  if (!url) {
    showShortcutError('请输入有效的网址，例如 https://example.com 或 example.com。');
    urlInput.focus();
    return;
  }
  if (editingId) {
    const index = preferences.shortcuts.findIndex(item => item.id === editingId);
    if (index < 0) return;
    preferences.shortcuts[index] = { id: editingId, name, url };
  } else {
    if (preferences.shortcuts.length >= MAX_SHORTCUTS) {
      showShortcutError(`最多添加 ${MAX_SHORTCUTS} 个快捷方式。`);
      return;
    }
    preferences.shortcuts.push({ id: makeShortcutId(), name, url });
  }
  renderShortcuts();
  persist('快捷方式已保存。');
  shortcutDialog.close();
});

deleteButton.addEventListener('click', () => {
  const item = preferences.shortcuts.find(item => item.id === editingId);
  if (!item || !window.confirm(`删除“${item.name}”这个快捷方式？`)) return;
  preferences.shortcuts = preferences.shortcuts.filter(item => item.id !== editingId);
  renderShortcuts();
  persist('快捷方式已删除。');
  shortcutDialog.close();
});

window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY || shortcutDialog.open) return;
  preferences = loadPreferences(storage).preferences;
  applyTheme(preferences.theme);
  applyEngine(preferences.engine);
  renderShortcuts();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateClock(); });

applyTheme(preferences.theme);
applyEngine(preferences.engine);
renderShortcuts();
updateClock();
setInterval(updateClock, 1000);
if (loaded.status === 'corrupt') showStatus('已恢复可用设置。你可以重新调整页面。');
if (loaded.status === 'unavailable') showStatus('浏览器暂时无法保存设置。本次打开仍可正常使用。');
