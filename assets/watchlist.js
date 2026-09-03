import { renderCard } from './card.js';
import { sortByRelease } from './data.js';

/** リストに入っている作品だけを公開順で返す。 */
export function listedWorks(works, list) {
  return sortByRelease(works.filter((w) => list.has(w.id)));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** ウォッチリストビュー。リストの変更後は refresh() で再描画する。 */
export function createWatchlist(container, works, { store, list }) {
  container.classList.add('watchlist');

  function refresh() {
    const lead = el('p', 'watchlist__lead', '作品カードを右クリック（スマホは長押し）で追加・削除できます。');
    const items = listedWorks(works, list);
    if (!items.length) {
      container.replaceChildren(lead);
      return;
    }
    const ul = el('ul', 'watchlist__grid');
    for (const work of items) {
      const li = el('li', 'watchlist__cell');
      li.append(renderCard(work, { store, list, thumb: true }));
      ul.append(li);
    }
    container.replaceChildren(lead, ul);
  }

  refresh();
  return { refresh };
}
