import { renderCard } from './card.js';
import { displayTitle, formatDate, phaseLabel, posterUrl, sortByRelease } from './data.js';

/** 予習リストの id を作品に解決する。未収録の id は捨てる。 */
export function prepEntries(guide, byId) {
  return guide.items
    .map((item) => ({ work: byId.get(item.id), note: item.note }))
    .filter((entry) => entry.work);
}

/** essential な作品をフェーズごとに公開順でまとめる。 */
export function phaseGroups(works) {
  const groups = new Map();
  for (const work of sortByRelease(works.filter((w) => w.essential))) {
    if (!groups.has(work.phase)) groups.set(work.phase, []);
    groups.get(work.phase).push(work);
  }
  return [...groups.keys()].sort((a, b) => a - b).map((phase) => ({ phase, works: groups.get(phase) }));
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

/** 飾りのポスター帯。画像が1枚もなければ null。 */
function heroBand(works) {
  const band = el('div', 'guide__hero');
  band.setAttribute('aria-hidden', 'true');
  for (const work of works) {
    const url = posterUrl(work);
    if (!url) continue;
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.loading = 'lazy';
    band.append(img);
  }
  return band.childElementCount ? band : null;
}

/** サムネの横スクロール列。note があればサムネの下に添える。 */
function thumbStrip(entries, store) {
  const ol = el('ol', 'strip guide__strip');
  for (const { work, note } of entries) {
    const li = el('li', 'guide__thumb');
    li.append(renderCard(work, { store, thumb: true, tapToggle: true }));
    if (note) li.append(el('p', 'guide__note', note));
    ol.append(li);
  }
  return ol;
}

function routeRows(groups, store) {
  return groups.map(({ phase, works }) => {
    const row = el('div', 'guide__row');
    row.append(
      el('h3', 'guide__phase', phaseLabel(phase)),
      thumbStrip(works.map((work) => ({ work })), store),
    );
    return row;
  });
}

export function renderGuide(container, works, guides, { store }) {
  const byId = new Map(works.map((w) => [w.id, w]));
  container.classList.add('guide');

  const groups = phaseGroups(works);
  const sections = [];
  const hero = heroBand(groups.flatMap((g) => g.works));
  if (hero) sections.push(hero);
  sections.push(section(
    '短縮ルート',
    '大作につながる主要作を、フェーズごとに公開順で並べたルートです。',
    ...routeRows(groups, store),
  ));

  for (const guide of guides.prep) {
    const target = byId.get(guide.target);
    if (!target) continue;
    const frame = document.createElement('iframe');
    frame.className = 'guide__map';
    frame.src = `diagrams/${guide.target}.html`;
    frame.title = `${displayTitle(target)} 予習マップ`;
    frame.loading = 'lazy';
    frame.addEventListener('load', () => {
      // 同一オリジンの生成物なので、埋め込みでは不要なビューア操作バー（ズーム%表示など）を隠す
      try {
        const doc = frame.contentDocument;
        if (!doc) return;
        const style = doc.createElement('style');
        style.textContent = '.diagram-nav { display: none !important; }';
        (doc.head ?? doc.documentElement).append(style);
        for (const textEl of doc.querySelectorAll('svg text')) {
          if (textEl.textContent.trim() === 'Legend') textEl.closest('g')?.setAttribute('display', 'none');
        }
      } catch {
        /* クロスオリジン時は何もしない */
      }
    });
    sections.push(section(
      `『${displayTitle(target)}』の予習`,
      `${formatDate(target.dateUs) ?? '公開日未定'} 公開。先に観ておく作品と理由です。`,
      thumbStrip(prepEntries(guide, byId), store),
      el('h3', 'guide__subtitle', '予習マップ'),
      frame,
    ));
  }
  container.replaceChildren(...sections);
}
