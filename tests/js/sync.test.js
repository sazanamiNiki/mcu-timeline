import test from 'node:test';
import assert from 'node:assert/strict';
import { CODE_RE, newSyncCode, parseState, pickNewer } from '../../assets/sync.js';

test('newSyncCode は形式に合うコードを毎回生成する', () => {
  const a = newSyncCode();
  const b = newSyncCode();
  assert.match(a, CODE_RE);
  assert.match(b, CODE_RE);
  assert.notEqual(a, b);
});

test('parseState は正しい形だけを受け付け、文字列以外の id を捨てる', () => {
  const ok = parseState({ watched: ['a', 1, 'b'], list: [], updatedAt: 123 });
  assert.deepEqual(ok, { watched: ['a', 'b'], list: [], updatedAt: 123 });
  assert.equal(parseState(null), null);
  assert.equal(parseState('x'), null);
  assert.equal(parseState({ watched: 'a', list: [], updatedAt: 1 }), null);
  assert.equal(parseState({ watched: [], list: [] }), null);
});

test('pickNewer は updatedAt が新しい方を返し、null は相手に譲る', () => {
  const older = { watched: ['a'], list: [], updatedAt: 100 };
  const newer = { watched: ['b'], list: [], updatedAt: 200 };
  assert.equal(pickNewer(older, newer), newer);
  assert.equal(pickNewer(newer, older), newer);
  assert.equal(pickNewer(newer, { ...older, updatedAt: 200 }), newer);
  assert.equal(pickNewer(null, newer), newer);
  assert.equal(pickNewer(older, null), older);
  assert.equal(pickNewer(null, null), null);
});
