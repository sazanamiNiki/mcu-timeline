// 作品データの読み込みと正規化。DOM に依存しない純粋関数だけを置く。

export const INCLUDED_SERIES_TYPES = new Set(['series', 'special']);
export const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
export const KIND_LABELS = { film: '映画', series: 'ドラマ', special: 'スペシャル' };

export function phaseLabel(phase) {
  return `フェーズ${phase}`;
}

export function isIncludedSeries(raw) {
  return raw.canon === 'main' && INCLUDED_SERIES_TYPES.has(raw.type);
}

/** 生レコードを表示用の Work に変換する。kind は 'film' | 'series' | 'special'。 */
export function toWork(raw, kind) {
  const isFilm = kind === 'film';
  return {
    id: raw.id,
    kind,
    titleJa: raw.title_ja,
    titleEn: raw.title_en,
    season: kind === 'series' ? raw.season ?? null : null,
    phase: raw.phase,
    dateUs: (isFilm ? raw.release_us : raw.premiere_us) ?? null,
    dateJp: (isFilm ? raw.release_jp : raw.premiere_jp) ?? null,
    summary: raw.summary_ja ?? '',
    upcoming: raw.status !== 'released',
    timelineOrder: raw.timeline_order ?? Number.MAX_SAFE_INTEGER,
    storyYear: raw.story_year ?? '',
    lane: raw.lane ?? 'other',
    essential: raw.essential === true,
    posterPath: raw.poster_path ?? null,
  };
}

/**
 * 同一シリーズの複数シーズンを1エントリに統合する。
 * 代表は最初のシーズンで、シーズン表記は消す。エッジは代表に張り替え、
 * シーズン間エッジ（自己参照になるもの）と重複は捨てる。
 */
export function mergeSeasons(works, edges) {
  const groups = new Map();
  for (const work of works) {
    const m = work.id.match(/^(.+)-s\d+$/);
    if (!m) continue;
    if (!groups.has(m[1])) groups.set(m[1], []);
    groups.get(m[1]).push(work);
  }
  const alias = new Map();
  const merged = new Map();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => (a.season ?? 0) - (b.season ?? 0));
    const [rep, ...rest] = list;
    merged.set(rep.id, { ...rep, season: null });
    for (const w of rest) alias.set(w.id, rep.id);
  }
  const outEdges = [];
  const seen = new Set();
  for (const e of edges) {
    const from = alias.get(e.from) ?? e.from;
    const to = alias.get(e.to) ?? e.to;
    if (from === to) continue;
    const key = `${from}\u2192${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    outEdges.push({ ...e, from, to });
  }
  return {
    works: works.filter((w) => !alias.has(w.id)).map((w) => merged.get(w.id) ?? w),
    edges: outEdges,
  };
}

/** 収録対象（正史の実写作品）だけを公開順で返す。 */
export function includedWorks(data) {
  const films = data.films.map((f) => toWork(f, 'film'));
  const series = data.series.filter(isIncludedSeries).map((s) => toWork(s, s.type));
  return sortByRelease([...films, ...series], 'asc');
}

/** 並べ替え用の日付キー。'2027-03' は '2027-03-01'、未定は末尾に回す。 */
export function releaseKey(work) {
  if (!work.dateUs) return '9999-12-31';
  const [y, m = '01', d = '01'] = work.dateUs.split('-');
  return `${y}-${m}-${d}`;
}

export function sortByRelease(works, dir = 'asc') {
  const sorted = [...works].sort(
    (a, b) => releaseKey(a).localeCompare(releaseKey(b)) || a.id.localeCompare(b.id),
  );
  return dir === 'desc' ? sorted.reverse() : sorted;
}

export function sortByStory(works, dir = 'asc') {
  const sorted = [...works].sort((a, b) => a.timelineOrder - b.timelineOrder);
  return dir === 'desc' ? sorted.reverse() : sorted;
}

export function displayTitle(work) {
  return work.kind === 'series' && work.season ? `${work.titleJa} シーズン${work.season}` : work.titleJa;
}

export function matchesQuery(work, query) {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return true;
  return work.titleJa.toLowerCase().includes(q) || work.titleEn.toLowerCase().includes(q);
}

export function posterUrl(work) {
  return work.posterPath ? `${POSTER_BASE}${work.posterPath}` : null;
}

/** '2026-07-31' → '2026年7月31日'、'2027-03' → '2027年3月'、空なら null。 */
export function formatDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  if (!m) return `${Number(y)}年`;
  if (!d) return `${Number(y)}年${Number(m)}月`;
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}

/** カード表示用。日付がなければ、公開予定なら「未定」、公開済みなら「—」。 */
export function dateLabel(iso, upcoming) {
  return formatDate(iso) ?? (upcoming ? '未定' : '—');
}

export async function loadJson(url, fetchFn = globalThis.fetch) {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`${url} の読み込みに失敗しました (${res.status})`);
  return res.json();
}
