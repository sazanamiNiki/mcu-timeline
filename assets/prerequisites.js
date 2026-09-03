// 「先に観る作品」の計算。依存エッジから前提の有無・遡り・丸めを導く純粋関数だけを置く。

import { ancestorsOf } from './graph-layout.js';
import { sortByRelease } from './data.js';

/** 直接の前提がこれ以上ある作品は合流点（クロスオーバー級）とみなし、丸めの起点にする。 */
const ROLL_MIN_PREREQS = 3;

/** 前提の有無で作品を分ける。どちらも公開順。 */
export function splitByPrerequisites(works, edges) {
  const hasIncoming = new Set(edges.map((e) => e.to));
  const sorted = sortByRelease(works);
  return {
    standalone: sorted.filter((w) => !hasIncoming.has(w.id)),
    dependent: sorted.filter((w) => hasIncoming.has(w.id)),
  };
}

/** id の先に観る作品を遡って公開順で返す。未収録の id は捨てる。 */
export function prerequisiteWorks(id, works, edges) {
  const byId = new Map(works.map((w) => [w.id, w]));
  const ancestors = [...ancestorsOf(id, edges)].map((aid) => byId.get(aid)).filter(Boolean);
  return sortByRelease(ancestors);
}

/**
 * 先に観る作品のうち、クロスオーバー級の作品の前提チェーンはその1枚に丸め込む。
 * 公開が新しい順に見て、残した作品の前提はすべて非表示にする。
 */
export function rolledPrerequisites(id, works, edges) {
  const directCount = new Map();
  for (const e of edges) directCount.set(e.to, (directCount.get(e.to) ?? 0) + 1);
  const covered = new Set();
  const visible = [];
  for (const work of prerequisiteWorks(id, works, edges).reverse()) {
    if (covered.has(work.id)) continue;
    visible.push(work);
    if ((directCount.get(work.id) ?? 0) >= ROLL_MIN_PREREQS) {
      for (const c of ancestorsOf(work.id, edges)) covered.add(c);
    }
  }
  return visible.reverse();
}
