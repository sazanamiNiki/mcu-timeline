import { renderCard } from './card.js';
import { displayTitle, formatDate, sortByRelease } from './data.js';

/** 予習リストの id を作品に解決する。未収録の id は捨てる。 */
export function prepEntries(guide, byId) {
  return guide.items
    .map((item) => ({ work: byId.get(item.id), note: item.note }))
    .filter((entry) => entry.work);
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

function orderedList(entries, store) {
  const ol = el('ol', 'guide__list');
  for (const { work, note } of entries) {
    const li = el('li', 'guide__item');
    li.append(renderCard(work, { store, compact: true, tapToggle: true }));
    if (note) li.append(el('p', 'guide__note', note));
    ol.append(li);
  }
  return ol;
}

export function renderGuide(container, works, guides, { store }) {
  const byId = new Map(works.map((w) => [w.id, w]));
  container.classList.add('guide');

  const essential = sortByRelease(works.filter((w) => w.essential)).map((work) => ({ work }));
  const sections = [
    section('短縮ルート', `大作につながる主要作 ${essential.length} 本を公開順に並べたルートです。`, orderedList(essential, store)),
  ];

  for (const guide of guides.prep) {
    const target = byId.get(guide.target);
    if (!target) continue;
    const frame = document.createElement('iframe');
    frame.className = 'guide__map';
    frame.src = `diagrams/${guide.target}.html`;
    frame.title = `${displayTitle(target)} 予習マップ`;
    frame.loading = 'lazy';
    sections.push(section(
      `『${displayTitle(target)}』の予習`,
      `${formatDate(target.dateUs) ?? '公開日未定'} 公開。先に観ておく作品と理由です。`,
      orderedList(prepEntries(guide, byId), store),
      el('h3', 'guide__subtitle', '予習マップ'),
      frame,
    ));
  }
  container.replaceChildren(...sections);
}
