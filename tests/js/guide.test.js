import test from 'node:test';
import assert from 'node:assert/strict';
import { prepEntries } from '../../assets/guide.js';

test('prepEntries は id を作品に解決し、未収録は捨てる', () => {
  const byId = new Map([['a', { id: 'a' }], ['b', { id: 'b' }]]);
  const guide = { target: 'z', items: [{ id: 'a', note: 'x' }, { id: 'nope', note: 'y' }, { id: 'b', note: 'z' }] };
  const entries = prepEntries(guide, byId);
  assert.deepEqual(entries.map((e) => e.work.id), ['a', 'b']);
  assert.deepEqual(entries.map((e) => e.note), ['x', 'z']);
});
