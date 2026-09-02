import test from 'node:test';
import assert from 'node:assert/strict';
import { shortLabel } from '../../assets/graph.js';

test('shortLabel は長い題名を省略記号つきで切る', () => {
  const short = { kind: 'film', titleJa: 'アントマン', season: null };
  const long = { kind: 'film', titleJa: 'ガーディアンズ・オブ・ギャラクシー:リミックス', season: null };
  const series = { kind: 'series', titleJa: 'ロキ', season: 2 };
  assert.equal(shortLabel(short), 'アントマン');
  assert.equal(shortLabel(long), 'ガーディアンズ・オ…');
  assert.equal(shortLabel(series), 'ロキ シーズン2');
  assert.equal(shortLabel(long, 5), 'ガーディ…');
});
