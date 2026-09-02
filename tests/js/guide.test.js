import test from 'node:test';
import assert from 'node:assert/strict';
import { splitByPrerequisites, prerequisiteEntries } from '../../assets/guide.js';

const WORKS = [
  { id: 'a', dateUs: '2008-05-02' },
  { id: 'd', dateUs: '2010-05-07' },
  { id: 'b', dateUs: '2012-04-25' },
  { id: 'c', dateUs: '2018-04-27' },
];
const EDGES = [
  { from: 'a', to: 'b', note: 'x' },
  { from: 'b', to: 'c', note: 'y' },
  { from: 'z', to: 'c', note: 'unincluded' },
];

test('splitByPrerequisites は前提の有無で分け、どちらも公開順に並べる', () => {
  const { standalone, dependent } = splitByPrerequisites(WORKS, EDGES);
  assert.deepEqual(standalone.map((w) => w.id), ['a', 'd']);
  assert.deepEqual(dependent.map((w) => w.id), ['b', 'c']);
});

test('prerequisiteEntries は先に観る作品を遡って公開順で返し、直接の前提だけ note を持つ', () => {
  const entries = prerequisiteEntries('c', WORKS, EDGES);
  assert.deepEqual(entries.map((e) => e.work.id), ['a', 'b']);
  assert.deepEqual(entries.map((e) => e.note), [undefined, 'y']);
});
