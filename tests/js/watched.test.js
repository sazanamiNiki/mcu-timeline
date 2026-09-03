import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatchedStore, createIdSetStore, STORAGE_KEY } from '../../assets/watched.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

test('toggle は追加と削除を切り替え、JSON 配列で保存する', () => {
  const storage = fakeStorage();
  const store = createWatchedStore(storage);
  assert.equal(store.available, true);
  assert.equal(store.has('iron-man'), false);
  assert.equal(store.toggle('iron-man'), true);
  assert.equal(store.has('iron-man'), true);
  assert.deepEqual(JSON.parse(storage.dump()[STORAGE_KEY]), ['iron-man']);
  assert.equal(store.toggle('iron-man'), false);
  assert.deepEqual(store.ids(), []);
});

test('保存済みの配列を読み込む', () => {
  const store = createWatchedStore(fakeStorage({ [STORAGE_KEY]: '["thor","loki-s1"]' }));
  assert.deepEqual(store.ids().sort(), ['loki-s1', 'thor']);
});

test('壊れた JSON は空として扱う', () => {
  const store = createWatchedStore(fakeStorage({ [STORAGE_KEY]: '{oops' }));
  assert.equal(store.available, true);
  assert.deepEqual(store.ids(), []);
});

test('storage が null なら available=false で、toggle は例外を投げない', () => {
  const store = createWatchedStore(null);
  assert.equal(store.available, false);
  assert.doesNotThrow(() => store.toggle('iron-man'));
});

test('setItem が例外を投げる storage は available=false', () => {
  const throwing = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => {} };
  const store = createWatchedStore(throwing);
  assert.equal(store.available, false);
  assert.doesNotThrow(() => store.toggle('iron-man'));
});

test('createIdSetStore は指定キーで保存し、他のキーと混ざらない', () => {
  const storage = fakeStorage();
  const list = createIdSetStore(storage, 'mcu-watchlist');
  const watched = createWatchedStore(storage);
  list.toggle('thor');
  watched.toggle('iron-man');
  assert.deepEqual(JSON.parse(storage.dump()['mcu-watchlist']), ['thor']);
  assert.deepEqual(JSON.parse(storage.dump()[STORAGE_KEY]), ['iron-man']);
  assert.equal(list.has('iron-man'), false);
});
