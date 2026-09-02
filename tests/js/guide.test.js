import test from 'node:test';
import assert from 'node:assert/strict';
import { prepEntries, phaseGroups } from '../../assets/guide.js';

test('prepEntries は id を作品に解決し、未収録は捨てる', () => {
  const byId = new Map([['a', { id: 'a' }], ['b', { id: 'b' }]]);
  const guide = { target: 'z', items: [{ id: 'a', note: 'x' }, { id: 'nope', note: 'y' }, { id: 'b', note: 'z' }] };
  const entries = prepEntries(guide, byId);
  assert.deepEqual(entries.map((e) => e.work.id), ['a', 'b']);
  assert.deepEqual(entries.map((e) => e.note), ['x', 'z']);
});

test('phaseGroups は essential をフェーズごとに公開順でまとめる', () => {
  const works = [
    { id: 'c', phase: 2, essential: true, dateUs: '2013-05-03' },
    { id: 'x', phase: 1, essential: false, dateUs: '2008-06-13' },
    { id: 'b', phase: 1, essential: true, dateUs: '2012-04-25' },
    { id: 'a', phase: 1, essential: true, dateUs: '2008-05-02' },
  ];
  const groups = phaseGroups(works);
  assert.deepEqual(groups.map((g) => g.phase), [1, 2]);
  assert.deepEqual(groups[0].works.map((w) => w.id), ['a', 'b']);
  assert.deepEqual(groups[1].works.map((w) => w.id), ['c']);
});
