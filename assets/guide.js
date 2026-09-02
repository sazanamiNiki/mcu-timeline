import { renderCard } from './card.js';
import { ancestorsOf } from './graph-layout.js';
import { displayTitle, sortByRelease } from './data.js';

/** 直接の前提がこれ以上ある作品は合流点（クロスオーバー級）とみなし、丸めの起点にする。 */
const ROLL_MIN_PREREQS = 3;

/** 前提の有無で作品を分ける。どちらも公開順。 */
export function splitByPrerequisites(works, edges) {
  const hasIncoming = new Set(edges.map((e) => e.to));
  const sorted = sortByRelease(works);
  return {
    standalone: sorted.filter((w) => !hasIncoming.has(w.id)),
    dependent: sorted.filter((w) => hasIncoming.has(w.id)),
  };
}

/** id の先に観る作品を遡って公開順で返す。未収録の id は捨てる。 */
export function prerequisiteWorks(id, works, edges) {
  const byId = new Map(works.map((w) => [w.id, w]));
  const ancestors = [...ancestorsOf(id, edges)].map((aid) => byId.get(aid)).filter(Boolean);
  return sortByRelease(ancestors);
}

/**
 * 先に観る作品のうち、クロスオーバー級の作品の前提チェーンはその1枚に丸め込む。
 * 公開が新しい順に見て、残した作品の前提はすべて非表示にする。
 */
export function rolledPrerequisites(id, works, edges) {
  const directCount = new Map();
  for (const e of edges) directCount.set(e.to, (directCount.get(e.to) ?? 0) + 1);
  const covered = new Set();
  const visible = [];
  for (const work of prerequisiteWorks(id, works, edges).reverse()) {
    if (covered.has(work.id)) continue;
    visible.push(work);
    if ((directCount.get(work.id) ?? 0) >= ROLL_MIN_PREREQS) {
      for (const c of ancestorsOf(work.id, edges)) covered.add(c);
    }
  }
  return visible.reverse();
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

function cellOf(card) {
  const li = el('li', 'guide__cell');
  li.append(card);
  return li;
}

function grid(cells) {
  const ul = el('ul', 'guide__grid');
  ul.append(...cells);
  return ul;
}

/** カード全体をボタン化する。視聴済みチェックのクリックは素通しする。 */
function makeTappable(card, action) {
  card.classList.add('card--tappable');
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.addEventListener('click', (event) => {
    if (event.target.closest('.card__watched')) return;
    action();
  });
  card.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('.card__watched')) return;
    event.preventDefault();
    action();
  });
}

export function renderGuide(container, works, edges, { store }) {
  container.classList.add('guide');
  const { standalone, dependent } = splitByPrerequisites(works, edges);
  const dependentIds = new Set(dependent.map((w) => w.id));

  const standaloneCells = standalone.map((work) => cellOf(renderCard(work, { store, thumb: true })));

  const cells = new Map(); // id → { li, card }
  let open = null; // { id, panel, card }

  const close = () => {
    if (!open) return;
    open.panel.remove();
    open.card.setAttribute('aria-expanded', 'false');
    open.card.classList.remove('is-open');
    open = null;
  };

  /** 前提サムネの横スクロール列。前提を持つ作品はタップでその作品のパネルへ。 */
  function prereqStrip(prereqs) {
    const ol = el('ol', 'strip guide__strip');
    for (const work of prereqs) {
      const li = el('li', 'guide__thumb');
      const card = renderCard(work, { store, thumb: true });
      if (dependentIds.has(work.id)) makeTappable(card, () => drill(work));
      li.append(card);
      ol.append(li);
    }
    return ol;
  }

  function openFor(work) {
    close();
    const entry = cells.get(work.id);
    const panel = el('li', 'guide__panel');
    panel.append(
      el('h3', 'guide__panel-title', `『${displayTitle(work)}』の先に観る作品`),
      prereqStrip(rolledPrerequisites(work.id, works, edges)),
    );
    entry.li.after(panel);
    entry.card.setAttribute('aria-expanded', 'true');
    entry.card.classList.add('is-open');
    open = { id: work.id, panel, card: entry.card };
  }

  function drill(work) {
    openFor(work);
    cells.get(work.id).card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    cells.get(work.id).card.focus({ preventScroll: true });
  }

  const dependentCells = dependent.map((work) => {
    const card = renderCard(work, { store, thumb: true });
    const li = cellOf(card);
    cells.set(work.id, { li, card });
    card.classList.add('card--expandable');
    card.setAttribute('aria-expanded', 'false');
    makeTappable(card, () => {
      const wasOpen = open?.id === work.id;
      close();
      if (!wasOpen) openFor(work);
    });
    return li;
  });

  container.replaceChildren(
    section('単体で観られる作品', '前提となる作品がなく、ここから観始められます。', grid(standaloneCells)),
    section('前提がある作品', '押すと、先に観ておく作品を公開順で表示します。前提を持つ作品はさらにたどれます。', grid(dependentCells)),
  );
}
