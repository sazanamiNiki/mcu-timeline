// 視聴済みなどの「id の集合」の保存。localStorage 互換の storage を注入する。DOM に依存しない。

export const STORAGE_KEY = 'mcu-watched';
export const WATCHLIST_KEY = 'mcu-watchlist';
const PROBE_KEY = '__mcu_probe__';

function readIds(storage, key) {
  try {
    const raw = storage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** 指定キーに id の集合を保存するストア。 */
export function createIdSetStore(storage, key) {
  let available = false;
  let ids = new Set();
  try {
    if (storage) {
      storage.setItem(PROBE_KEY, '1');
      storage.removeItem(PROBE_KEY);
      available = true;
      ids = new Set(readIds(storage, key));
    }
  } catch {
    available = false;
  }

  function persist() {
    if (!available) return;
    try {
      storage.setItem(key, JSON.stringify([...ids]));
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

export function createWatchedStore(storage) {
  return createIdSetStore(storage, STORAGE_KEY);
}
