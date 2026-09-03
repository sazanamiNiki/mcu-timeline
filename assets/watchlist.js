import { renderCard, makeTappable } from './card.js';
import { sortByRelease } from './data.js';
import { codeFromInput } from './sync.js';

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

function button(label, onClick) {
  const btn = el('button', null, label);
  btn.type = 'button';
  btn.addEventListener('click', onClick);
  return btn;
}

/** ウォッチリストビュー。リストや同期状態の変更後は refresh() で再描画する。 */
export function createWatchlist(container, works, { store, list, sync, prereqIds, onShowPrereqs }) {
  container.classList.add('watchlist');

  function syncControls() {
    if (!sync) return null;
    const box = el('div', 'watchlist__sync');
    box.append(el('h2', 'watchlist__sync-title', '端末間で同期'));
    const note = el('p', 'watchlist__sync-note');
    box.append(note);
    const row = el('div', 'watchlist__sync-row');
    const input = document.createElement('input');
    input.className = 'watchlist__sync-code';
    if (sync.code) {
      note.textContent = 'このリンクを他の端末で開くと、視聴済みとウォッチリストを共有します。';
      input.readOnly = true;
      input.value = `${location.origin}${location.pathname}#sync=${sync.code}`;
      input.addEventListener('focus', () => input.select());
      const copy = button('リンクをコピー', async () => {
        try {
          await navigator.clipboard.writeText(input.value);
          copy.textContent = 'コピーしました';
          setTimeout(() => { copy.textContent = 'リンクをコピー'; }, 1200);
        } catch {
          input.select();
        }
      });
      row.append(input, copy, button('解除', () => { sync.disable(); refresh(); }));
    } else {
      note.textContent = '共有リンクを発行するか、他の端末で発行したリンクを貼り付けて参加します。';
      input.placeholder = '他の端末のリンク';
      const join = button('参加', async () => {
        const code = codeFromInput(input.value);
        const ok = code ? await sync.join(code) : false;
        if (ok) refresh();
        else note.textContent = 'リンクの形式が違います。発行したリンクをそのまま貼り付けてください。';
      });
      const enable = button('共有リンクを発行', () => { sync.enable(); refresh(); });
      enable.classList.add('watchlist__sync-primary');
      box.append(enable);
      row.append(input, join);
    }
    box.append(row);
    return box;
  }

  function refresh() {
    const parts = [el('p', 'watchlist__lead', '作品カードを右クリック（スマホは長押し）で追加・削除できます。')];
    const items = listedWorks(works, list);
    if (items.length) {
      const ul = el('ul', 'watchlist__list');
      for (const work of items) {
        const li = el('li');
        const card = renderCard(work, { store, list, compact: true, withSummary: true });
        if (onShowPrereqs && prereqIds?.has(work.id)) {
          makeTappable(card, () => onShowPrereqs(work));
        }
        li.append(card);
        ul.append(li);
      }
      parts.push(ul);
    }
    const controls = syncControls();
    if (controls) parts.push(controls);
    container.replaceChildren(...parts);
  }

  refresh();
  return { refresh };
}
