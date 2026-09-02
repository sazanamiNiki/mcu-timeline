import { loadJson, includedWorks } from './data.js';
import { createWatchedStore } from './watched.js';
import { createTimeline } from './timeline.js';
import { createGraph } from './graph.js';
import { renderGuide } from './guide.js';

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
  let deps;
  let guides;
  try {
    [data, deps, guides] = await Promise.all([
      loadJson('data/mcu-works.json'),
      loadJson('data/dependencies.json'),
      loadJson('data/guides.json'),
    ]);
  } catch (err) {
    showStatus(`データを読み込めませんでした: ${err.message}`);
    return;
  }
  const works = includedWorks(data);
  const store = createWatchedStore(storageOrNull());
  document.getElementById('updated').textContent = data.meta.generated;
  if (!store.available) showStatus('このブラウザでは視聴済みを保存できません');

  const release = createTimeline(document.getElementById('view-release'), works, { mode: 'release', store });
  const story = createTimeline(document.getElementById('view-story'), works, { mode: 'story', store });
  const graph = createGraph(document.getElementById('view-graph'), works, deps.edges, { store });
  renderGuide(document.getElementById('view-guide'), works, guides, { store });

  // 視聴済みの変更を、他のビューの同じ作品カードにも反映する
  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.closest('.card__watched')) return;
    const card = input.closest('.card');
    if (!card) return;
    const watched = store.has(card.dataset.id);
    for (const other of document.querySelectorAll(`.card[data-id="${CSS.escape(card.dataset.id)}"]`)) {
      const otherInput = other.querySelector('.card__watched input');
      const otherLabel = other.querySelector('.card__watched');
      if (otherInput) otherInput.checked = watched;
      if (otherLabel) otherLabel.classList.toggle('is-watched', watched);
      other.classList.toggle('card--watched', watched);
    }
    graph.setWatched(card.dataset.id, watched);
  });

  const search = document.getElementById('search');
  search.addEventListener('input', () => {
    release.setQuery(search.value);
    story.setQuery(search.value);
    graph.setQuery(search.value);
  });

  const applyHash = () => activateTab(tabFromHash(location.hash));
  window.addEventListener('hashchange', applyHash);
  applyHash();
}

if (typeof document !== 'undefined') init();
