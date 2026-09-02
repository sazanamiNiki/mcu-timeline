import { NODE_W, NODE_H, layoutGraph, ancestorsOf, edgePath, collapseLanes, nodeTransform, detailPosition } from './graph-layout.js';
import { displayTitle, posterUrl, matchesQuery, dateLabel, KIND_LABELS, phaseLabel } from './data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_VIEW_W = 1600;
const ASPECT = 0.6;

/** 図の中で使う短い題名。max 字を超えたら省略記号で切る。 */
export function shortLabel(work, max = 10) {
  const title = displayTitle(work);
  return title.length > max ? `${title.slice(0, max - 1)}…` : title;
}

function svgEl(name, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, title) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.title = title;
  return b;
}

const HINT = '作品を押すと概要と、先に観る作品の強調を表示します。ドラッグで移動、ピンチかボタンで拡大縮小。';

export function createGraph(container, works, edges, { store } = {}) {
  const layout = layoutGraph(works, edges);
  const byId = new Map(works.map((w) => [w.id, w]));
  container.classList.add('graph');

  const toolbar = document.createElement('div');
  toolbar.className = 'graph__toolbar';
  const zoomOut = button('－', '縮小');
  const zoomIn = button('＋', '拡大');
  const reset = button('リセット', '表示位置と強調を戻す');
  const info = document.createElement('p');
  info.className = 'graph__info';
  info.textContent = HINT;
  toolbar.append(zoomOut, zoomIn, reset, info);

  const detail = document.createElement('div');
  detail.className = 'graph__detail';
  detail.hidden = true;

  const svg = svgEl('svg', { class: 'graph__svg', role: 'group', 'aria-label': 'MCU作品の依存関係図' });
  const laneLayer = svgEl('g', { class: 'graph__lanes' });
  const laneEls = layout.lanes.map((lane, i) => {
    const rect = svgEl('rect', {
      x: 0, y: lane.y - 20, width: layout.width, height: layout.rowHeight,
      class: `graph__lane${i % 2 ? ' graph__lane--alt' : ''}`,
    });
    const label = svgEl('text', { x: 12, y: lane.y + NODE_H / 2, class: 'graph__lane-label' }, lane.label);
    laneLayer.append(rect, label);
    return { lane, rect, label };
  });

  /** 行の背景とラベルを更新する。laneY が null なら全行を元の位置に戻す。 */
  function applyLanes(laneY) {
    laneEls.forEach(({ lane, rect, label }, i) => {
      const y = laneY ? laneY.get(lane.id) : lane.y;
      const hidden = y === undefined;
      rect.classList.toggle('is-hidden', hidden);
      label.classList.toggle('is-hidden', hidden);
      if (hidden) return;
      const stripe = laneY ? [...laneY.keys()].indexOf(lane.id) : i;
      rect.classList.toggle('graph__lane--alt', stripe % 2 === 1);
      rect.setAttribute('y', y - 20);
      label.setAttribute('y', y + NODE_H / 2);
    });
  }

  const edgeLayer = svgEl('g', { class: 'graph__edges' });
  const edgeEls = layout.edges.map((edge) => {
    const path = svgEl('path', {
      d: edgePath(edge.x1, edge.y1, edge.x2, edge.y2), class: 'graph__edge',
      'data-from': edge.from, 'data-to': edge.to,
    });
    path.append(svgEl('title', {}, edge.note));
    edgeLayer.append(path);
    return { edge, path };
  });

  const nodeLayer = svgEl('g', { class: 'graph__nodes' });
  const nodeEls = new Map();
  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));
  for (const node of layout.nodes) {
    const g = svgEl('g', {
      class: 'graph__node', transform: nodeTransform(node.x, node.y), 'data-id': node.id, tabindex: 0, role: 'button',
    });
    g.append(svgEl('rect', { width: NODE_W, height: NODE_H, rx: 6, class: 'graph__node-box' }));
    const url = posterUrl(node.work);
    if (url) g.append(svgEl('image', { href: url, width: NODE_W, height: NODE_H, preserveAspectRatio: 'xMidYMid slice' }));
    else g.append(svgEl('text', { x: NODE_W / 2, y: NODE_H / 2, 'text-anchor': 'middle', class: 'graph__node-initial' }, displayTitle(node.work).slice(0, 2)));
    g.append(svgEl('rect', { width: NODE_W, height: NODE_H, rx: 6, class: 'graph__node-frame' }));
    const badge = svgEl('g', { class: 'graph__watched', transform: `translate(${NODE_W - 8} -4)` });
    badge.append(svgEl('circle', { r: 9, class: 'graph__watched-bg' }));
    badge.append(svgEl('path', { d: 'M -4 0 L -1 3 L 4 -3', class: 'graph__watched-check' }));
    g.append(badge);
    g.classList.toggle('is-watched', Boolean(store && store.available && store.has(node.id)));
    g.append(svgEl('text', { x: NODE_W / 2, y: NODE_H + 16, 'text-anchor': 'middle', class: 'graph__label' }, shortLabel(node.work)));
    g.append(svgEl('title', {}, `${displayTitle(node.work)}（${node.work.dateUs ?? '公開日未定'}）`));
    nodeLayer.append(g);
    nodeEls.set(node.id, g);
  }
  svg.append(laneLayer, edgeLayer, nodeLayer);
  container.append(toolbar, detail, svg);

  // 表示範囲（viewBox）でパンとズームを表す
  const view = { x: 0, y: 0, w: Math.min(layout.width, DEFAULT_VIEW_W), h: 0 };
  view.h = view.w * ASPECT;
  function applyView() {
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    positionDetail();
  }
  function zoomBy(factor, cx = view.x + view.w / 2, cy = view.y + view.h / 2) {
    const w = Math.min(Math.max(view.w * factor, 300), layout.width * 2);
    const h = w * ASPECT;
    view.x = cx - (cx - view.x) * (w / view.w);
    view.y = cy - (cy - view.y) * (h / view.h);
    view.w = w;
    view.h = h;
    applyView();
  }
  function toSvgPointXY(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    return {
      x: view.x + ((clientX - rect.left) / rect.width) * view.w,
      y: view.y + ((clientY - rect.top) / rect.height) * view.h,
    };
  }

  /** クリックした作品の概要パネル。id が null なら閉じる。 */
  function renderDetail(id, ancestorCount) {
    detail.replaceChildren();
    if (!id) {
      detail.hidden = true;
      return;
    }
    const work = byId.get(id);
    const meta = `${KIND_LABELS[work.kind]} · ${phaseLabel(work.phase)}${work.upcoming ? ' · 公開予定' : ''}`;
    detail.append(
      el('p', 'graph__detail-title', displayTitle(work)),
      el('p', 'graph__detail-en', work.titleEn),
      el('p', 'graph__detail-meta', meta),
      el('p', 'graph__detail-dates', `日本 ${dateLabel(work.dateJp, work.upcoming)} / 米国 ${dateLabel(work.dateUs, work.upcoming)}`),
      el('p', 'graph__detail-summary', work.summary),
      el('p', 'graph__detail-deps', ancestorCount > 0 ? '先に観る作品を強調し、関係のない行は畳んでいます' : '先に観る作品はありません'),
    );
    detail.hidden = false;
  }

  /** 概要カードを、強調中のサムネの横に配置する。 */
  function positionDetail() {
    if (!focused || detail.hidden) return;
    const g = nodeEls.get(focused);
    if (!g) return;
    const area = svg.getBoundingClientRect();
    const host = container.getBoundingClientRect();
    const r = g.getBoundingClientRect();
    const pos = detailPosition(
      { x: r.left - area.left, y: r.top - area.top, w: r.width, h: r.height },
      { w: detail.offsetWidth, h: detail.offsetHeight },
      { w: area.width, h: area.height },
    );
    detail.style.left = `${pos.x + area.left - host.left}px`;
    detail.style.top = `${pos.y + area.top - host.top}px`;
  }

  let focused = null;
  const FOCUS_SCALE = 1.3;
  const ANCESTOR_SCALE = 1.15;
  function highlight(id) {
    focused = id;
    const set = id ? ancestorsOf(id, edges) : null;
    const laneY = set ? collapseLanes(new Set([id, ...set]), layout) : null;
    for (const [nodeId, g] of nodeEls) {
      const node = nodeById.get(nodeId);
      const y = laneY ? laneY.get(node.laneId) : node.y;
      const hidden = y === undefined;
      g.classList.toggle('is-hidden', hidden);
      g.classList.toggle('is-focus', nodeId === id);
      g.classList.toggle('is-ancestor', Boolean(set && set.has(nodeId)));
      g.classList.toggle('is-muted', Boolean(set) && nodeId !== id && !set.has(nodeId));
      if (hidden) continue;
      const scale = nodeId === id ? FOCUS_SCALE : set && set.has(nodeId) ? ANCESTOR_SCALE : 1;
      g.setAttribute('transform', nodeTransform(node.x, y, scale));
    }
    for (const { edge, path } of edgeEls) {
      const ya = laneY ? laneY.get(nodeById.get(edge.from).laneId) : nodeById.get(edge.from).y;
      const yb = laneY ? laneY.get(nodeById.get(edge.to).laneId) : nodeById.get(edge.to).y;
      const hidden = ya === undefined || yb === undefined;
      path.classList.toggle('is-hidden', hidden);
      if (!hidden) path.setAttribute('d', edgePath(edge.x1, ya + NODE_H / 2, edge.x2, yb + NODE_H / 2));
      const on = Boolean(set) && set.has(edge.from) && (edge.to === id || set.has(edge.to));
      path.classList.toggle('is-ancestor', on);
      path.classList.toggle('is-muted', Boolean(set) && !on);
    }
    applyLanes(laneY);
    if (laneY) {
      view.y = 0;
      applyView();
    }
    renderDetail(id, set ? set.size : 0);
    positionDetail();
  }

  function setQuery(query) {
    const q = (query ?? '').trim();
    for (const [nodeId, g] of nodeEls) g.classList.toggle('is-match', Boolean(q) && matchesQuery(byId.get(nodeId), q));
  }

  zoomIn.addEventListener('click', () => zoomBy(0.8));
  zoomOut.addEventListener('click', () => zoomBy(1.25));
  reset.addEventListener('click', () => {
    view.x = 0;
    view.y = 0;
    view.w = Math.min(layout.width, DEFAULT_VIEW_W);
    view.h = view.w * ASPECT;
    applyView();
    highlight(null);
  });

  // ホイール単体では反応しない（ページのスクロールに任せる）。
  // トラックパッドのピンチはブラウザが ctrlKey つきの wheel として届けるので、それだけズームに使う。
  svg.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const p = toSvgPointXY(event.clientX, event.clientY);
    zoomBy(event.deltaY > 0 ? 1.1 : 0.9, p.x, p.y);
  }, { passive: false });

  // 1本指: パンとクリック。2本指: ピンチでズーム。
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  let pinched = false;

  function pinchInfo() {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  svg.addEventListener('pointerdown', (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    svg.setPointerCapture(event.pointerId);
    if (pointers.size === 2) {
      drag = null;
      pinch = pinchInfo();
      pinched = true;
    } else if (pointers.size === 1 && !pinched) {
      drag = {
        x: event.clientX,
        y: event.clientY,
        vx: view.x,
        vy: view.y,
        moved: false,
        node: event.target.closest('.graph__node'),
      };
    }
  });
  svg.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && pointers.size === 2) {
      const now = pinchInfo();
      if (pinch.dist > 0 && now.dist > 0) {
        const p = toSvgPointXY(now.cx, now.cy);
        zoomBy(pinch.dist / now.dist, p.x, p.y);
      }
      pinch = now;
      return;
    }
    if (!drag) return;
    const scale = view.w / svg.getBoundingClientRect().width;
    const dx = (event.clientX - drag.x) * scale;
    const dy = (event.clientY - drag.y) * scale;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    view.x = drag.vx - dx;
    view.y = drag.vy - dy;
    applyView();
  });
  function endPointer(event, cancelled) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pinched) {
      drag = null;
      if (pointers.size === 0) pinched = false;
      return;
    }
    const { moved, node } = drag ?? {};
    drag = null;
    if (cancelled || moved) return;
    highlight(node ? node.dataset.id : null);
  }
  svg.addEventListener('pointerup', (event) => endPointer(event, false));
  svg.addEventListener('pointercancel', (event) => endPointer(event, true));

  svg.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.classList.contains('graph__node')) {
      event.preventDefault();
      highlight(event.target.dataset.id);
    }
  });
  // パン後などフォーカスが図の外に移っても Esc で解除できるように document で拾う
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && focused) highlight(null);
  });

  applyView();
  window.addEventListener('resize', positionDetail);
  return {
    highlight,
    setQuery,
    setWatched(id, watched) {
      nodeEls.get(id)?.classList.toggle('is-watched', watched);
    },
    get focused() {
      return focused;
    },
  };
}
