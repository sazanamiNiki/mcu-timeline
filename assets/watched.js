// 視聴済みの保存。localStorage 互換の storage を注入する。DOM に依存しない。

export const STORAGE_KEY = 'mcu-watched';
const PROBE_KEY = '__mcu_probe__';

function readIds(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function createWatchedStore(storage) {
  let available = false;
  let ids = new Set();
  try {
    if (storage) {
      storage.setItem(PROBE_KEY, '1');
      storage.removeItem(PROBE_KEY);
      available = true;
      ids = new Set(readIds(storage));
    }
  } catch {
    available = false;
  }

  function persist() {
    if (!available) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
      available = false;
    }
  }

  return {
    get available() {
      return available;
    },
    has: (id) => ids.has(id),
    toggle(id) {
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      persist();
      return ids.has(id);
    },
    ids: () => [...ids],
  };
}
