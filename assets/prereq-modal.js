import { renderCard, makeTappable } from './card.js';
import { displayTitle } from './data.js';
import { splitByPrerequisites, rolledPrerequisites } from './guide.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * 「先に観る作品」を表示するモーダル。open(work) で開き、
 * 中の前提を持つサムネをタップすると中身がその作品に切り替わる。
 */
export function createPrereqModal(works, edges, { store, list }) {
  const dependentIds = new Set(splitByPrerequisites(works, edges).dependent.map((w) => w.id));
  const dialog = document.createElement('dialog');
  dialog.className = 'prereq-modal';
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close(); // 背景タップで閉じる
  });
  document.body.append(dialog);

  function render(work) {
    const head = el('div', 'prereq-modal__head');
    const close = el('button', 'prereq-modal__close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', '閉じる');
    close.addEventListener('click', () => dialog.close());
    head.append(el('h2', 'prereq-modal__title', `『${displayTitle(work)}』の先に観る作品`), close);

    const strip = el('ol', 'strip prereq-modal__strip');
    for (const prereq of rolledPrerequisites(work.id, works, edges)) {
      const li = el('li', 'prereq-modal__thumb');
      const card = renderCard(prereq, { store, list, thumb: true });
      if (dependentIds.has(prereq.id)) {
        card.classList.add('card--expandable');
        makeTappable(card, () => render(prereq));
      }
      li.append(card);
      strip.append(li);
    }
    dialog.replaceChildren(head, strip);
  }

  return {
    dependentIds,
    open(work) {
      render(work);
      if (!dialog.open) dialog.showModal();
    },
  };
}
