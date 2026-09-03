import { displayTitle, dateLabel, posterUrl, KIND_LABELS, phaseLabel } from './data.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function placeholder(work) {
  return el('div', 'card__placeholder', displayTitle(work));
}

function posterBlock(work) {
  const poster = el('div', 'card__poster');
  const url = posterUrl(work);
  if (!url) {
    poster.append(placeholder(work));
    return poster;
  }
  const img = document.createElement('img');
  img.src = url;
  img.alt = displayTitle(work);
  img.loading = 'lazy';
  img.width = 342;
  img.height = 513;
  img.addEventListener('error', () => {
    img.remove();
    poster.append(placeholder(work));
  });
  poster.append(img);
  return poster;
}

/** 視聴済み状態をカード内のボタンとクラスに反映する。 */
export function applyWatchedState(card, watched) {
  const btn = card.querySelector('.card__watched');
  if (btn) {
    btn.textContent = watched ? '✓ 視聴済み' : '視聴済み';
    btn.setAttribute('aria-pressed', String(watched));
    btn.classList.toggle('is-watched', watched);
  }
  card.classList.toggle('card--watched', watched);
}

function watchedButton(work, store, onChange, card) {
  const btn = el('button', 'card__watched');
  btn.type = 'button';
  btn.disabled = !(store && store.available);
  btn.addEventListener('click', (event) => {
    event.stopPropagation(); // カード側のタップ動作（モーダル等）を起こさない
    const watched = store.toggle(work.id);
    applyWatchedState(card, watched);
    btn.dispatchEvent(new CustomEvent('mcu:watched-change', { bubbles: true, detail: { id: work.id, watched } }));
    if (onChange) onChange(work, watched);
  });
  return btn;
}

/** カード全体をボタン化する。視聴済みボタンのクリックは素通しする。 */
export function makeTappable(card, action) {
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

/** 作品カードを返す。compact は横長、thumb はポスター＋視聴済みボタンのみの小型表示。 */
export function renderCard(work, { store, list, onChange, compact = false, thumb = false, withSummary = !compact && !thumb } = {}) {
  const card = el('article', `card${thumb ? ' card--thumb' : compact ? ' card--compact' : ''}`);
  card.dataset.id = work.id;
  card.dataset.phase = String(work.phase);
  if (work.upcoming) card.classList.add('card--upcoming');
  if (work.essential) card.classList.add('card--essential');
  if (list?.has(work.id)) card.classList.add('card--listed');

  const body = el('div', 'card__body');
  if (thumb) {
    card.title = displayTitle(work);
  } else {
    const meta = `${KIND_LABELS[work.kind]} · ${phaseLabel(work.phase)}${work.upcoming ? ' · 公開予定' : ''}`;
    body.append(
      el('p', 'card__meta', meta),
      el('h3', 'card__title', displayTitle(work)),
      el('p', 'card__title-en', work.titleEn),
      el('p', 'card__dates', `日本 ${dateLabel(work.dateJp, work.upcoming)} / 米国 ${dateLabel(work.dateUs, work.upcoming)}`),
    );
  }
  if (withSummary) body.append(el('p', 'card__summary', work.summary));
  body.append(watchedButton(work, store, onChange, card));

  card.append(posterBlock(work), body);
  applyWatchedState(card, Boolean(store && store.available) && store.has(work.id));
  return card;
}
