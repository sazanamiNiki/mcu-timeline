import { loadJson, includedWorks } from './data.js';
import { createWatchedStore } from './watched.js';
import { renderCard } from './card.js';

export const TABS = ['release', 'story', 'graph', 'guide'];

/** '#story' → 'story'。未知や空なら 'release'。 */
export function tabFromHash(hash) {
  const name = (hash ?? '').replace(/^#/, '');
  return TABS.includes(name) ? name : 'release';
}

function storageOrNull() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function showStatus(message) {
  const status = document.getElementById('status');
  status.hidden = !message;
  status.textContent = message ?? '';
}

function activateTab(name) {
  for (const section of document.querySelectorAll('.view')) section.hidden = section.dataset.view !== name;
  for (const link of document.querySelectorAll('.tabs a')) {
    link.setAttribute('aria-current', link.dataset.tab === name ? 'page' : 'false');
  }
}

async function init() {
  let data;
  try {
    data = await loadJson('data/mcu-works.json');
  } catch (err) {
    showStatus(`データを読み込めませんでした: ${err.message}`);
    return;
  }
  const works = includedWorks(data);
  const store = createWatchedStore(storageOrNull());
  document.getElementById('updated').textContent = data.meta.generated;
  if (!store.available) showStatus('このブラウザでは視聴済みを保存できません');

  const strip = document.createElement('div');
  strip.className = 'strip';
  strip.append(...works.map((work) => renderCard(work, { store })));
  document.getElementById('view-release').append(strip);

  const applyHash = () => activateTab(tabFromHash(location.hash));
  window.addEventListener('hashchange', applyHash);
  applyHash();
}

if (typeof document !== 'undefined') init();
