import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../sync-worker/worker.js';

function fakeKV(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get: async (k) => (map.has(k) ? map.get(k) : null),
    put: async (k, v) => map.set(k, v),
    dump: () => Object.fromEntries(map),
  };
}

const URL_BASE = 'https://sync.example/sync/';

test('PUT で保存し GET で返す。CORS ヘッダ付き', async () => {
  const env = { SYNC: fakeKV() };
  const put = await worker.fetch(new Request(URL_BASE + 'abcd-1234', { method: 'PUT', body: '{"watched":["iron-man"]}' }), env);
  assert.equal(put.status, 204);
  const got = await worker.fetch(new Request(URL_BASE + 'abcd-1234'), env);
  assert.equal(got.status, 200);
  assert.equal(got.headers.get('Access-Control-Allow-Origin'), '*');
  assert.deepEqual(await got.json(), { watched: ['iron-man'] });
});

test('未保存のキーは 404', async () => {
  const res = await worker.fetch(new Request(URL_BASE + 'no-data-here'), { SYNC: fakeKV() });
  assert.equal(res.status, 404);
});

test('キー形式外のパスは 404（大文字・短すぎ・別パス）', async () => {
  const env = { SYNC: fakeKV() };
  for (const path of ['https://sync.example/sync/ABCD1234', URL_BASE + 'short', 'https://sync.example/other/abcd-1234']) {
    const res = await worker.fetch(new Request(path, { method: 'PUT', body: '{}' }), env);
    assert.equal(res.status, 404, path);
  }
  assert.deepEqual(env.SYNC.dump(), {});
});

test('4KB 超・JSON でない・オブジェクトでないボディは拒否', async () => {
  const env = { SYNC: fakeKV() };
  const big = await worker.fetch(new Request(URL_BASE + 'abcd-1234', { method: 'PUT', body: '{"x":"' + 'a'.repeat(5000) + '"}' }), env);
  assert.equal(big.status, 413);
  const bad = await worker.fetch(new Request(URL_BASE + 'abcd-1234', { method: 'PUT', body: '{oops' }), env);
  assert.equal(bad.status, 400);
  const arr = await worker.fetch(new Request(URL_BASE + 'abcd-1234', { method: 'PUT', body: '[1,2]' }), env);
  assert.equal(arr.status, 400);
  assert.deepEqual(env.SYNC.dump(), {});
});

test('OPTIONS プリフライトは 204 で PUT を許可', async () => {
  const res = await worker.fetch(new Request(URL_BASE + 'abcd-1234', { method: 'OPTIONS' }), { SYNC: fakeKV() });
  assert.equal(res.status, 204);
  assert.match(res.headers.get('Access-Control-Allow-Methods'), /PUT/);
});
