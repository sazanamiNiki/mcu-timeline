import { renderCard } from './card.js';
import { sortByRelease, sortByStory, matchesQuery } from './data.js';

/** 連続する同じキーの作品をまとめる。順序は保つ。 */
export function groupWorks(works, keyFn) {
  const groups = [];
  for (const work of works) {
    const key = keyFn(work);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.works.push(work);
    else groups.push({ key, works: [work] });
  }
  return groups;
}

export const releaseKeyFn = (work) => (work.dateUs ? `${work.dateUs.slice(0, 4)}年` : '未定');
export const storyKeyFn = (work) => work.storyYear || '未発表';

/** 検索と主要作ハイライトからカードの表示状態を決める。 */
export function cardState(work, { query = '', essentialOnly = false } = {}) {
  if (!matchesQuery(work, query)) return 'hidden';
  if (essentialOnly && !work.essential) return 'dim';
  return 'normal';
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 横スクロールのタイムラインを container に描く。mode は 'release' か 'story'。 */
export function createTimeline(container, works, { mode, store, list }) {
  const state = { query: '', dir: 'asc', essentialOnly: false };
  const cards = new Map();
  container.classList.add('timeline');

  const controls = el('div', 'timeline__controls');
  const sortButton = el('button', 'timeline__sort');
  sortButton.type = 'button';
  sortButton.title = '押すと並び順を反転します';
  const essentialLabel = el('label', 'timeline__essential');
  const essentialInput = document.createElement('input');
  essentialInput.type = 'checkbox';
  essentialLabel.append(essentialInput, el('span', null, ' 主要作をハイライト'));
  controls.append(sortButton, essentialLabel);

  const track = el('div', 'timeline__track');
  container.append(controls, track);

  function applyStates() {
    for (const { work, card } of cards.values()) {
      const stateName = cardState(work, state);
      card.hidden = stateName === 'hidden';
      card.classList.toggle('is-dim', stateName === 'dim');
    }
    for (const group of track.querySelectorAll('.timeline__group')) {
      group.hidden = !group.querySelector('.card:not([hidden])');
    }
  }

  function renderTrack() {
    const sorted = mode === 'release' ? sortByRelease(works, state.dir) : sortByStory(works, state.dir);
    const groups = groupWorks(sorted, mode === 'release' ? releaseKeyFn : storyKeyFn);
    cards.clear();
    track.replaceChildren(...groups.map((group) => {
      const section = el('section', 'timeline__group');
      const row = el('div', 'timeline__row');
      for (const work of group.works) {
        const card = renderCard(work, { store, list, compact: true, withSummary: true, tapToggle: true });
        cards.set(work.id, { work, card });
        row.append(card);
      }
      section.append(el('h2', 'timeline__heading', group.key), row);
      return section;
    }));
    applyStates();
  }

  function updateSortLabel() {
    sortButton.textContent = state.dir === 'asc' ? '並び: 古い順' : '並び: 新しい順';
  }

  sortButton.addEventListener('click', () => {
    state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    updateSortLabel();
    renderTrack();
  });
  essentialInput.addEventListener('change', () => {
    state.essentialOnly = essentialInput.checked;
    applyStates();
  });

  updateSortLabel();
  renderTrack();

  return {
    setQuery(query) {
      state.query = query ?? '';
      applyStates();
    },
  };
}
