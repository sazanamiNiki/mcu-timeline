import { loadJson, includedWorks, mergeSeasons } from './data.js';
import { createWatchedStore, createIdSetStore, WATCHLIST_KEY } from './watched.js';
import { createTimeline } from './timeline.js';
import { createGraph } from './graph.js';
import { renderGuide } from './guide.js';
import { createWatchlist } from './watchlist.js';
import { createSync, SYNC_ENDPOINT } from './sync.js';
import { createPrereqModal } from './prereq-modal.js';
import { applyWatchedState } from './card.js';

export const TABS = ['release', 'story', 'graph', 'guide', 'watchlist'];

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
  try {
    [data, deps] = await Promise.all([
      loadJson('data/mcu-works.json'),
      loadJson('data/dependencies.json'),
    ]);
  } catch (err) {
    showStatus(`データを読み込めませんでした: ${err.message}`);
    return;
  }
  const { works, edges } = mergeSeasons(includedWorks(data), deps.edges);
  const store = createWatchedStore(storageOrNull());
  const list = createIdSetStore(storageOrNull(), WATCHLIST_KEY);
  let applyRemote = () => {};
  const sync = createSync({
    storage: storageOrNull(),
    store,
    list,
    endpoint: globalThis.MCU_SYNC_ENDPOINT ?? SYNC_ENDPOINT, // ローカル検証用の上書き口
    onApply: () => applyRemote(),
  });
  if (location.hash.startsWith('#sync=')) {
    await sync.join(decodeURIComponent(location.hash.slice('#sync='.length)));
    history.replaceState(null, '', '#watchlist');
  } else {
    await sync.pull();
  }
  document.getElementById('updated').textContent = data.meta.generated;
  if (!store.available) showStatus('このブラウザでは視聴済みを保存できません');

  const prereqModal = createPrereqModal(works, edges, { store, list });
  const showPrereqs = (work) => prereqModal.open(work);
  const release = createTimeline(document.getElementById('view-release'), works, { mode: 'release', store, list, prereqIds: prereqModal.dependentIds, onShowPrereqs: showPrereqs });
  const story = createTimeline(document.getElementById('view-story'), works, { mode: 'story', store, list, prereqIds: prereqModal.dependentIds, onShowPrereqs: showPrereqs });
  const graph = createGraph(document.getElementById('view-graph'), works, edges, { store });
  renderGuide(document.getElementById('view-guide'), works, edges, { store, list });
  const watchlist = createWatchlist(document.getElementById('view-watchlist'), works, { store, list, sync, prereqIds: prereqModal.dependentIds, onShowPrereqs: showPrereqs });
  applyRemote = () => {
    for (const card of document.querySelectorAll('.card[data-id]')) {
      applyWatchedState(card, store.has(card.dataset.id));
      card.classList.toggle('card--listed', list.has(card.dataset.id));
    }
    for (const work of works) graph.setWatched(work.id, store.has(work.id));
    watchlist.refresh();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sync.pull();
  });

  // 視聴済みの変更を、他のビューの同じ作品カードにも反映する
  document.addEventListener('mcu:watched-change', (event) => {
    const { id, watched } = event.detail;
    for (const other of document.querySelectorAll(`.card[data-id="${CSS.escape(id)}"]`)) {
      applyWatchedState(other, watched);
    }
    graph.setWatched(id, watched);
    sync.markDirty();
  });

  // ウォッチリスト: カードの右クリック（スマホは長押し）で追加・削除をトグルする
  const lastGesture = new Map();
  function toggleListed(id) {
    const now = Date.now();
    if (now - (lastGesture.get(id) ?? 0) < 700) return; // 長押しと contextmenu の二重発火ガード
    lastGesture.set(id, now);
    const listed = list.toggle(id);
    for (const other of document.querySelectorAll(`.card[data-id="${CSS.escape(id)}"]`)) {
      other.classList.toggle('card--listed', listed);
    }
    watchlist.refresh();
  }
  document.addEventListener('contextmenu', (event) => {
    const card = event.target.closest('.card[data-id]');
    if (!card || !list.available) return;
    event.preventDefault();
    toggleListed(card.dataset.id);
  });
  // iOS は長押しで contextmenu が発火しないため、ポインタで長押しを判定する
  let press = null;
  let suppressClickUntil = 0;
  const cancelPress = () => {
    if (!press) return;
    clearTimeout(press.timer);
    press = null;
  };
  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    const card = event.target.closest('.card[data-id]');
    if (!card || !list.available) return;
    cancelPress();
    press = {
      x: event.clientX,
      y: event.clientY,
      timer: setTimeout(() => {
        press = null;
        suppressClickUntil = Date.now() + 600; // 長押し後のタップ誤発火（視聴済み・展開）を抑止
        toggleListed(card.dataset.id);
      }, 550),
    };
  });
  document.addEventListener('pointermove', (event) => {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) cancelPress();
  });
  document.addEventListener('pointerup', cancelPress);
  document.addEventListener('pointercancel', cancelPress);
  document.addEventListener('click', (event) => {
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

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
