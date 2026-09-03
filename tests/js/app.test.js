import test from 'node:test';
import assert from 'node:assert/strict';
import { tabFromHash, TABS } from '../../assets/app.js';

test('TABS は5つ', () => assert.deepEqual(TABS, ['release', 'story', 'graph', 'guide', 'watchlist']));

test('tabFromHash はハッシュからタブ名を取り、不明なら release', () => {
  assert.equal(tabFromHash('#story'), 'story');
  assert.equal(tabFromHash('#graph'), 'graph');
  assert.equal(tabFromHash('#guide'), 'guide');
  assert.equal(tabFromHash('#watchlist'), 'watchlist');
  assert.equal(tabFromHash(''), 'release');
  assert.equal(tabFromHash('#nope'), 'release');
  assert.equal(tabFromHash(undefined), 'release');
});
