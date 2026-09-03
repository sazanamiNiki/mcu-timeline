import { renderCard, makeTappable } from './card.js';
import { displayTitle } from './data.js';
import { splitByPrerequisites, rolledPrerequisites } from './prerequisites.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * 「先に観る作品」を表示するモーダル。open(work) で開き、
 * 中の前提を持つサムネをタップすると中身がその作品に切り替わる。
 * たどった履歴は「← 戻る」で戻れる（開き直すとリセット）。
 */
export function createPrereqModal(works, edges, { store, list }) {
  const dependentIds = new Set(splitByPrerequisites(works, edges).dependent.map((w) => w.id));
  const dialog = document.createElement('dialog');
  dialog.className = 'prereq-modal';
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close(); // 背景タップで閉じる
  });
  document.body.append(dialog);
  let trail = []; // たどってきた作品の履歴。末尾が表示中

  function render() {
    const work = trail[trail.length - 1];
    dialog.setAttribute('aria-label', `『${displayTitle(work)}』の先に観る作品`);
    const bar = el('div', 'prereq-modal__bar');
    if (trail.length > 1) {
      const back = el('button', 'prereq-modal__back', '← 戻る');
      back.type = 'button';
      back.addEventListener('click', () => {
        trail.pop();
        render();
      });
      bar.append(back);
    }
    const close = el('button', 'prereq-modal__close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', '閉じる');
    close.addEventListener('click', () => dialog.close());
    bar.append(close);

    const current = renderCard(work, { store, list, compact: true, withSummary: true });

    const strip = el('ol', 'strip prereq-modal__strip');
    for (const prereq of rolledPrerequisites(work.id, works, edges)) {
      const li = el('li', 'prereq-modal__thumb');
      const card = renderCard(prereq, { store, list, thumb: true });
      if (dependentIds.has(prereq.id)) {
        makeTappable(card, () => {
          trail.push(prereq);
          render();
        });
      }
      li.append(card);
      strip.append(li);
    }
    dialog.replaceChildren(bar, current, el('h3', 'prereq-modal__subtitle', '先に観る作品'), strip);
  }

  return {
    dependentIds,
    open(work) {
      trail = [work];
      render();
      if (!dialog.open) dialog.showModal();
    },
  };
}
