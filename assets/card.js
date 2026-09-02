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

function watchedToggle(work, store, onChange, card) {
  const label = el('label', 'card__watched');
  const input = document.createElement('input');
  input.type = 'checkbox';
  const usable = Boolean(store && store.available);
  input.disabled = !usable;
  input.checked = usable && store.has(work.id);
  label.classList.toggle('is-watched', input.checked);
  card.classList.toggle('card--watched', input.checked);
  input.addEventListener('change', () => {
    const now = store.toggle(work.id);
    label.classList.toggle('is-watched', now);
    card.classList.toggle('card--watched', now);
    if (onChange) onChange(work, now);
  });
  label.append(input, el('span', null, ' 視聴済み'));
  return label;
}

/** 作品カードを返す。compact は横長、thumb はポスター＋タイトルのみの小型、tapToggle はカード全体のタップで視聴済みを切り替える。 */
export function renderCard(work, { store, onChange, compact = false, thumb = false, tapToggle = false, withSummary = !compact && !thumb } = {}) {
  const card = el('article', `card${thumb ? ' card--thumb' : compact ? ' card--compact' : ''}`);
  card.dataset.id = work.id;
  card.dataset.phase = String(work.phase);
  if (work.upcoming) card.classList.add('card--upcoming');
  if (work.essential) card.classList.add('card--essential');

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
  body.append(watchedToggle(work, store, onChange, card));

  card.append(posterBlock(work), body);
  if (tapToggle) {
    card.classList.add('card--tappable');
    card.addEventListener('click', (event) => {
      if (event.target.closest('.card__watched')) return;
      const input = card.querySelector('.card__watched input');
      if (input && !input.disabled) input.click();
    });
  }
  return card;
}
