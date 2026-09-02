import { renderCard } from './card.js';
import { ancestorsOf } from './graph-layout.js';
import { displayTitle, sortByRelease } from './data.js';

/** 前提の有無で作品を分ける。どちらも公開順。 */
export function splitByPrerequisites(works, edges) {
  const hasIncoming = new Set(edges.map((e) => e.to));
  const sorted = sortByRelease(works);
  return {
    standalone: sorted.filter((w) => !hasIncoming.has(w.id)),
    dependent: sorted.filter((w) => hasIncoming.has(w.id)),
  };
}

/** id の先に観る作品を遡って公開順で返す。直接の前提だけ note を持つ。未収録の id は捨てる。 */
export function prerequisiteEntries(id, works, edges) {
  const byId = new Map(works.map((w) => [w.id, w]));
  const noteByFrom = new Map(edges.filter((e) => e.to === id).map((e) => [e.from, e.note]));
  const ancestors = [...ancestorsOf(id, edges)].map((aid) => byId.get(aid)).filter(Boolean);
  return sortByRelease(ancestors).map((work) => ({ work, note: noteByFrom.get(work.id) }));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(title, lead, ...children) {
  const sec = el('section', 'guide__section');
  sec.append(el('h2', 'guide__title', title), el('p', 'guide__lead', lead), ...children);
  return sec;
}

/** 前提サムネの横スクロール列。直接の前提には理由を添える。 */
function prereqStrip(entries, store) {
  const ol = el('ol', 'strip guide__strip');
  for (const { work, note } of entries) {
    const li = el('li', 'guide__thumb');
    li.append(renderCard(work, { store, thumb: true }));
    if (note) li.append(el('p', 'guide__note', note));
    ol.append(li);
  }
  return ol;
}

function grid(cells) {
  const ul = el('ul', 'guide__grid');
  ul.append(...cells);
  return ul;
}

function cellOf(card) {
  const li = el('li', 'guide__cell');
  li.append(card);
  return li;
}

export function renderGuide(container, works, edges, { store }) {
  container.classList.add('guide');
  const { standalone, dependent } = splitByPrerequisites(works, edges);

  const standaloneCells = standalone.map((work) => cellOf(renderCard(work, { store, thumb: true })));

  let open = null; // { id, panel, card }
  const close = () => {
    if (!open) return;
    open.panel.remove();
    open.card.setAttribute('aria-expanded', 'false');
    open.card.classList.remove('is-open');
    open = null;
  };

  const dependentCells = dependent.map((work) => {
    const card = renderCard(work, { store, thumb: true });
    const li = cellOf(card);
    card.classList.add('card--tappable', 'card--expandable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-expanded', 'false');
    const toggle = () => {
      const wasOpen = open?.id === work.id;
      close();
      if (wasOpen) return;
      const panel = el('li', 'guide__panel');
      panel.append(
        el('h3', 'guide__panel-title', `『${displayTitle(work)}』の先に観る作品`),
        prereqStrip(prerequisiteEntries(work.id, works, edges), store),
      );
      li.after(panel);
      card.setAttribute('aria-expanded', 'true');
      card.classList.add('is-open');
      open = { id: work.id, panel, card };
    };
    card.addEventListener('click', (event) => {
      if (event.target.closest('.card__watched')) return;
      toggle();
    });
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('.card__watched')) return;
      event.preventDefault();
      toggle();
    });
    return li;
  });

  container.replaceChildren(
    section('単体で観られる作品', '前提となる作品がなく、ここから観始められます。', grid(standaloneCells)),
    section('前提がある作品', '押すと、先に観ておく作品を公開順で表示します。', grid(dependentCells)),
  );
}
