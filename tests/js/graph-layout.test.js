import test from 'node:test';
import assert from 'node:assert/strict';
import { LANES, NODE_W, NODE_H, layoutGraph, ancestorsOf, edgePath, collapseLanes, nodeTransform, detailPosition } from '../../assets/graph-layout.js';

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

test('layoutGraph はノードに解決済み laneId を付け、未知レーンは other に落とす', () => {
  const layout = layoutGraph(WORKS, EDGES, { colWidth: 100, rowHeight: 50, marginX: 10, marginY: 5 });
  assert.deepEqual(layout.nodes.map((n) => n.laneId), ['iron', 'avengers', 'other']);
});

test('collapseLanes は関連作品のいる行だけを元の順序で上から詰める', () => {
  const layout = layoutGraph(WORKS, EDGES, { colWidth: 100, rowHeight: 50, marginX: 10, marginY: 5 });
  const laneY = collapseLanes(new Set(['a', 'c']), layout);
  assert.deepEqual([...laneY.entries()], [['iron', 5], ['other', 55]]);
});

test('collapseLanes はノードに存在しない id を無視する', () => {
  const layout = layoutGraph(WORKS, EDGES, { colWidth: 100, rowHeight: 50, marginX: 10, marginY: 5 });
  const laneY = collapseLanes(new Set(['zzz', 'b']), layout);
  assert.deepEqual([...laneY.entries()], [['avengers', 5]]);
});

test('nodeTransform は scale なしなら translate だけ、あれば中心を保って拡大する', () => {
  assert.equal(nodeTransform(100, 40), 'translate(100 40)');
  assert.equal(nodeTransform(100, 40, 1), 'translate(100 40)');
  assert.equal(nodeTransform(100, 40, 1.25), 'translate(91 26.5) scale(1.25)');
});

test('detailPosition は基本はノードの右横に置く', () => {
  const pos = detailPosition({ x: 100, y: 50, w: 72, h: 108 }, { w: 280, h: 200 }, { w: 1000, h: 600 });
  assert.deepEqual(pos, { x: 184, y: 50 });
});

test('detailPosition は右に入らなければ左横に置く', () => {
  const pos = detailPosition({ x: 800, y: 50, w: 72, h: 108 }, { w: 280, h: 200 }, { w: 1000, h: 600 });
  assert.deepEqual(pos, { x: 508, y: 50 });
});

test('detailPosition は左右どちらも入らなければ範囲内にクランプする', () => {
  const pos = detailPosition({ x: 10, y: 50, w: 72, h: 108 }, { w: 280, h: 200 }, { w: 250, h: 600 });
  assert.deepEqual(pos, { x: 0, y: 50 });
});

test('detailPosition は上下を表示領域内にクランプする', () => {
  assert.deepEqual(detailPosition({ x: 100, y: 550, w: 72, h: 108 }, { w: 280, h: 200 }, { w: 1000, h: 600 }).y, 400);
  assert.deepEqual(detailPosition({ x: 100, y: -50, w: 72, h: 108 }, { w: 280, h: 200 }, { w: 1000, h: 600 }).y, 0);
});
