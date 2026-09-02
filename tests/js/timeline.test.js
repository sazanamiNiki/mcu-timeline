import test from 'node:test';
import assert from 'node:assert/strict';
import { groupWorks, releaseKeyFn, storyKeyFn, cardState } from '../../assets/timeline.js';

const work = (id, dateUs, storyYear, essential = false) => ({
  id, dateUs, storyYear, essential, titleJa: id, titleEn: id, kind: 'film', season: null,
});

test('groupWorks は連続する同じキーをまとめ、順序を保つ', () => {
  const works = [work('a', '2021-01-15'), work('b', '2021-03-19'), work('c', '2022-03-30'), work('d', '2021-11-24')];
  const groups = groupWorks(works, releaseKeyFn);
  assert.deepEqual(groups.map((g) => g.key), ['2021年', '2022年', '2021年']);
  assert.deepEqual(groups[0].works.map((w) => w.id), ['a', 'b']);
});

test('releaseKeyFn / storyKeyFn', () => {
  assert.equal(releaseKeyFn(work('a', '2027-03')), '2027年');
  assert.equal(releaseKeyFn(work('a', null)), '未定');
  assert.equal(storyKeyFn(work('a', null, '1943–1945')), '1943–1945');
  assert.equal(storyKeyFn(work('a', null, '')), '未発表');
});

test('cardState は検索で hidden、主要作ハイライトで dim', () => {
  const essential = work('iron-man', '2008-05-02', '2008', true);
  const other = work('thor', '2011-05-06', '2010', false);
  assert.equal(cardState(other, { query: 'iron' }), 'hidden');
  assert.equal(cardState(essential, { query: 'iron' }), 'normal');
  assert.equal(cardState(other, { essentialOnly: true }), 'dim');
  assert.equal(cardState(essential, { essentialOnly: true }), 'normal');
  assert.equal(cardState(other, {}), 'normal');
  assert.equal(cardState(other, { query: 'thor', essentialOnly: true }), 'dim');
});
