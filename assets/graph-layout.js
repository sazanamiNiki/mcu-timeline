// 依存関係図の配置計算。横軸は公開順、縦軸は系列レーン。DOM に依存しない。
import { sortByRelease } from './data.js';

export const LANES = [
  { id: 'avengers', label: 'アベンジャーズ' },
  { id: 'iron', label: 'アイアンマン系' },
  { id: 'cap', label: 'キャプテン・アメリカ系' },
  { id: 'thor', label: 'ソー系' },
  { id: 'gotg', label: 'ガーディアンズ系' },
  { id: 'spidey', label: 'スパイダーマン系' },
  { id: 'strange', label: 'ストレンジ／ワンダ系' },
  { id: 'cosmic', label: 'キャプテン・マーベル系' },
  { id: 'street', label: 'ストリート系' },
  { id: 'antman', label: 'アントマン系' },
  { id: 'bp', label: 'ブラックパンサー系' },
  { id: 'other', label: 'その他' },
];

export const NODE_W = 72;
export const NODE_H = 108;

export function layoutGraph(works, edges, { colWidth = 110, rowHeight = 150, marginX = 170, marginY = 40 } = {}) {
  const ordered = sortByRelease(works, 'asc');
  const laneIndex = new Map(LANES.map((lane, i) => [lane.id, i]));
  const otherIndex = LANES.length - 1;
  const nodes = ordered.map((work, i) => {
    const laneId = laneIndex.has(work.lane) ? work.lane : LANES[otherIndex].id;
    return {
      id: work.id,
      work,
      laneId,
      x: marginX + i * colWidth,
      y: marginY + laneIndex.get(laneId) * rowHeight,
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const laidEdges = edges
    .filter((e) => byId.has(e.from) && byId.has(e.to))
    .map((e) => {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      return { ...e, x1: a.x + NODE_W, y1: a.y + NODE_H / 2, x2: b.x, y2: b.y + NODE_H / 2 };
    });
  const lanes = LANES.map((lane, i) => ({ ...lane, y: marginY + i * rowHeight }));
  return {
    nodes,
    edges: laidEdges,
    lanes,
    rowHeight,
    width: marginX + ordered.length * colWidth + marginX,
    height: marginY * 2 + LANES.length * rowHeight,
  };
}

/** id の前提作品を推移的に集める。自分は含まない。 */
export function ancestorsOf(id, edges) {
  const preds = new Map();
  for (const e of edges) {
    if (!preds.has(e.to)) preds.set(e.to, []);
    preds.get(e.to).push(e.from);
  }
  const seen = new Set();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    for (const p of preds.get(current) ?? []) {
      if (!seen.has(p)) {
        seen.add(p);
        stack.push(p);
      }
    }
  }
  return seen;
}

/** 右向きの3次ベジェ。近すぎるときも最低40pxの膨らみを持たせる。 */
export function edgePath(x1, y1, x2, y2) {
  const dx = Math.max(40, (x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/** タップ中の関連作品がいる行だけを上から詰めた y を返す。 */
export function collapseLanes(relevantIds, layout) {
  const occupied = new Set();
  for (const node of layout.nodes) if (relevantIds.has(node.id)) occupied.add(node.laneId);
  const top = layout.lanes[0].y;
  const laneY = new Map();
  for (const lane of layout.lanes) {
    if (occupied.has(lane.id)) laneY.set(lane.id, top + laneY.size * layout.rowHeight);
  }
  return laneY;
}

/** ノード配置の transform 文字列。scale 指定時は中心を保って拡大する。 */
export function nodeTransform(x, y, scale = 1) {
  if (scale === 1) return `translate(${x} ${y})`;
  const tx = x + ((1 - scale) * NODE_W) / 2;
  const ty = y + ((1 - scale) * NODE_H) / 2;
  return `translate(${tx} ${ty}) scale(${scale})`;
}

/** 概要カードの位置。ノードの右横、入らなければ左横、表示領域内にクランプ。 */
export function detailPosition(node, panel, bounds, gap = 12) {
  let x = node.x + node.w + gap;
  if (x + panel.w > bounds.w) x = node.x - panel.w - gap;
  if (x < 0) x = Math.max(0, Math.min(node.x + node.w + gap, bounds.w - panel.w));
  let y = Math.min(node.y, bounds.h - panel.h);
  if (y < 0) y = 0;
  return { x, y };
}
