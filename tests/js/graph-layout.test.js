import test from 'node:test';
import assert from 'node:assert/strict';
import { LANES, NODE_W, NODE_H, layoutGraph, ancestorsOf, edgePath } from '../../assets/graph-layout.js';

const work = (id, dateUs, lane) => ({ id, dateUs, lane, titleJa: id, titleEn: id, kind: 'film', season: null });
const WORKS = [work('b', '2012-05-04', 'avengers'), work('a', '2008-05-02', 'iron'), work('c', '2021-01-15', 'nowhere')];
const EDGES = [{ from: 'a', to: 'b', note: 'x' }, { from: 'b', to: 'c', note: 'y' }, { from: 'zzz', to: 'c', note: 'ghost' }];

test('LANES は12本で、先頭がアベンジャーズ、末尾がその他', () => {
  assert.equal(LANES.length, 12);
  assert.equal(LANES[0].id, 'avengers');
  assert.equal(LANES[11].id, 'other');
});

test('layoutGraph は公開順に x を並べ、レーンで y を決め、未知の辺を捨てる', () => {
  const layout = layoutGraph(WORKS, EDGES, { colWidth: 100, rowHeight: 50, marginX: 10, marginY: 5 });
  assert.deepEqual(layout.nodes.map((n) => n.id), ['a', 'b', 'c']);
  assert.deepEqual(layout.nodes.map((n) => n.x), [10, 110, 210]);
  assert.equal(layout.nodes[0].y, 5 + 50 * 1);
  assert.equal(layout.nodes[1].y, 5);
  assert.equal(layout.nodes[2].y, 5 + 50 * 11);
  assert.equal(layout.edges.length, 2);
  assert.equal(layout.edges[0].x1, 10 + NODE_W);
  assert.equal(layout.edges[0].y1, 5 + 50 + NODE_H / 2);
  assert.equal(layout.edges[0].x2, 110);
  assert.equal(layout.lanes.length, 12);
  assert.equal(layout.lanes[1].y, 55);
  assert.equal(layout.rowHeight, 50);
  assert.equal(layout.width, 10 + 3 * 100 + 10);
  assert.equal(layout.height, 5 * 2 + 12 * 50);
});

test('ancestorsOf は推移的に前提を集め、自分を含まない', () => {
  assert.deepEqual([...ancestorsOf('c', EDGES)].sort(), ['a', 'b', 'zzz']);
  assert.deepEqual([...ancestorsOf('b', EDGES)], ['a']);
  assert.deepEqual([...ancestorsOf('a', EDGES)], []);
});

test('edgePath は M で始まる3次ベジェ', () => {
  assert.match(edgePath(0, 0, 100, 50), /^M 0 0 C 50 0, 50 50, 100 50$/);
  assert.match(edgePath(0, 0, 20, 0), /^M 0 0 C 40 0, -20 0, 20 0$/);
});
