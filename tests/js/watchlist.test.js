import test from 'node:test';
import assert from 'node:assert/strict';
import { listedWorks } from '../../assets/watchlist.js';

test('listedWorks はリスト内の作品だけを公開順で返す', () => {
  const works = [
    { id: 'b', dateUs: '2012-04-25' },
    { id: 'a', dateUs: '2008-05-02' },
    { id: 'c', dateUs: '2018-04-27' },
  ];
  const list = { has: (id) => ['c', 'a'].includes(id) };
  assert.deepEqual(listedWorks(works, list).map((w) => w.id), ['a', 'c']);
});
