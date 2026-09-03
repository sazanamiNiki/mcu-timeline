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

function button(label, onClick) {
  const btn = el('button', null, label);
  btn.type = 'button';
  btn.addEventListener('click', onClick);
  return btn;
}

/** ウォッチリストビュー。リストや同期状態の変更後は refresh() で再描画する。 */
export function createWatchlist(container, works, { store, list, sync }) {
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
      note.textContent = 'このコードを他の端末で入力すると、視聴済みとウォッチリストを共有します。';
      input.readOnly = true;
      input.value = sync.code;
      input.addEventListener('focus', () => input.select());
      const copy = button('コピー', async () => {
        try {
          await navigator.clipboard.writeText(sync.code);
          copy.textContent = 'コピーしました';
          setTimeout(() => { copy.textContent = 'コピー'; }, 1200);
        } catch {
          input.select();
        }
      });
      row.append(input, copy, button('解除', () => { sync.disable(); refresh(); }));
    } else {
      note.textContent = 'コードを発行するか、他の端末で発行したコードを入力して参加します。';
      input.placeholder = '他の端末のコード';
      const join = button('参加', async () => {
        const ok = await sync.join(input.value.trim());
        if (ok) refresh();
        else note.textContent = 'コードの形式が違います。発行したコードをそのまま貼り付けてください。';
      });
      box.append(button('同期コードを発行', () => { sync.enable(); refresh(); }));
      row.append(input, join);
    }
    box.append(row);
    return box;
  }

  function refresh() {
    const parts = [el('p', 'watchlist__lead', '作品カードを右クリック（スマホは長押し）で追加・削除できます。')];
    const items = listedWorks(works, list);
    if (items.length) {
      const ul = el('ul', 'watchlist__grid');
      for (const work of items) {
        const li = el('li', 'watchlist__cell');
        li.append(renderCard(work, { store, list, thumb: true }));
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
