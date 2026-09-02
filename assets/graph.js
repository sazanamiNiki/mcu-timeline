import { NODE_W, NODE_H, layoutGraph, ancestorsOf, edgePath } from './graph-layout.js';
import { displayTitle, posterUrl, matchesQuery } from './data.js';

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

function button(label, title) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.title = title;
  return b;
}

const HINT = '作品を押すと、先に観る作品が強調されます。ドラッグで移動、ホイールで拡大縮小。';

export function createGraph(container, works, edges) {
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

  const svg = svgEl('svg', { class: 'graph__svg', role: 'img', 'aria-label': 'MCU作品の依存関係図' });
  const defs = svgEl('defs');
  const marker = svgEl('marker', {
    id: 'graph-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse',
  });
  marker.append(svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'graph__arrow' }));
  defs.append(marker);

  const laneLayer = svgEl('g', { class: 'graph__lanes' });
  layout.lanes.forEach((lane, i) => {
    laneLayer.append(svgEl('rect', {
      x: 0, y: lane.y - 20, width: layout.width, height: layout.rowHeight,
      class: `graph__lane${i % 2 ? ' graph__lane--alt' : ''}`,
    }));
    laneLayer.append(svgEl('text', { x: 12, y: lane.y + NODE_H / 2, class: 'graph__lane-label' }, lane.label));
  });

  const edgeLayer = svgEl('g', { class: 'graph__edges' });
  const edgeEls = layout.edges.map((edge) => {
    const path = svgEl('path', {
      d: edgePath(edge.x1, edge.y1, edge.x2, edge.y2), class: 'graph__edge', 'marker-end': 'url(#graph-arrow)',
      'data-from': edge.from, 'data-to': edge.to,
    });
    path.append(svgEl('title', {}, edge.note));
    edgeLayer.append(path);
    return { edge, path };
  });

  const nodeLayer = svgEl('g', { class: 'graph__nodes' });
  const nodeEls = new Map();
  for (const node of layout.nodes) {
    const g = svgEl('g', {
      class: 'graph__node', transform: `translate(${node.x} ${node.y})`, 'data-id': node.id, tabindex: 0, role: 'button',
    });
    g.append(svgEl('rect', { width: NODE_W, height: NODE_H, rx: 6, class: 'graph__node-box' }));
    const url = posterUrl(node.work);
    if (url) g.append(svgEl('image', { href: url, width: NODE_W, height: NODE_H, preserveAspectRatio: 'xMidYMid slice' }));
    else g.append(svgEl('text', { x: NODE_W / 2, y: NODE_H / 2, 'text-anchor': 'middle', class: 'graph__node-initial' }, displayTitle(node.work).slice(0, 2)));
    g.append(svgEl('rect', { width: NODE_W, height: NODE_H, rx: 6, class: 'graph__node-frame' }));
    g.append(svgEl('text', { x: NODE_W / 2, y: NODE_H + 16, 'text-anchor': 'middle', class: 'graph__label' }, shortLabel(node.work)));
    g.append(svgEl('title', {}, `${displayTitle(node.work)}（${node.work.dateUs ?? '公開日未定'}）`));
    nodeLayer.append(g);
    nodeEls.set(node.id, g);
  }
  svg.append(defs, laneLayer, edgeLayer, nodeLayer);
  container.append(toolbar, svg);

  // 表示範囲（viewBox）でパンとズームを表す
  const view = { x: 0, y: 0, w: Math.min(layout.width, DEFAULT_VIEW_W), h: 0 };
  view.h = view.w * ASPECT;
  function applyView() {
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
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
  function toSvgPoint(event) {
    const rect = svg.getBoundingClientRect();
    return {
      x: view.x + ((event.clientX - rect.left) / rect.width) * view.w,
      y: view.y + ((event.clientY - rect.top) / rect.height) * view.h,
    };
  }

  let focused = null;
  function highlight(id) {
    focused = id;
    const set = id ? ancestorsOf(id, edges) : null;
    for (const [nodeId, g] of nodeEls) {
      g.classList.toggle('is-focus', nodeId === id);
      g.classList.toggle('is-ancestor', Boolean(set && set.has(nodeId)));
      g.classList.toggle('is-muted', Boolean(set) && nodeId !== id && !set.has(nodeId));
    }
    for (const { edge, path } of edgeEls) {
      const on = Boolean(set) && set.has(edge.from) && (edge.to === id || set.has(edge.to));
      path.classList.toggle('is-ancestor', on);
      path.classList.toggle('is-muted', Boolean(set) && !on);
    }
    info.textContent = id ? `${displayTitle(byId.get(id))}: 先に観る作品 ${set.size} 本を強調しています` : HINT;
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
  svg.addEventListener('wheel', (event) => {
    event.preventDefault();
    const p = toSvgPoint(event);
    zoomBy(event.deltaY > 0 ? 1.1 : 0.9, p.x, p.y);
  }, { passive: false });

  let drag = null;
  svg.addEventListener('pointerdown', (event) => {
    drag = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y, moved: false };
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const scale = view.w / svg.getBoundingClientRect().width;
    const dx = (event.clientX - drag.x) * scale;
    const dy = (event.clientY - drag.y) * scale;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    view.x = drag.vx - dx;
    view.y = drag.vy - dy;
    applyView();
  });
  svg.addEventListener('pointerup', (event) => {
    const moved = drag?.moved;
    drag = null;
    if (moved) return;
    const node = event.target.closest('.graph__node');
    highlight(node ? node.dataset.id : null);
  });
  svg.addEventListener('pointercancel', () => {
    drag = null;
  });
  svg.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') highlight(null);
    if (event.key === 'Enter' && event.target.classList.contains('graph__node')) highlight(event.target.dataset.id);
  });

  applyView();
  return {
    highlight,
    setQuery,
    get focused() {
      return focused;
    },
  };
}
