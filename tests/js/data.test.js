import test from 'node:test';
import assert from 'node:assert/strict';
import {
  includedWorks, toWork, displayTitle, sortByRelease, sortByStory, matchesQuery,
  posterUrl, formatDate, dateLabel, loadJson, POSTER_BASE,
} from '../../assets/data.js';

const RAW = {
  meta: { generated: '2026-08-31' },
  films: [
    { id: 'iron-man', title_ja: 'アイアンマン', title_en: 'Iron Man', release_us: '2008-05-02', release_jp: '2008-09-27',
      phase: 1, status: 'released', summary_ja: 'a', timeline_order: 3, story_year: '2008', lane: 'iron', essential: true, poster_path: '/im.jpg' },
    { id: 'avengers-secret-wars', title_ja: 'アベンジャーズ/シークレット・ウォーズ', title_en: 'Avengers: Secret Wars', release_us: '2027-12-17',
      release_jp: null, phase: 6, status: 'upcoming', summary_ja: 'b', timeline_order: 60, story_year: '未発表', lane: 'avengers', essential: true },
  ],
  series: [
    { id: 'loki-s2', type: 'series', canon: 'main', season: 2, title_ja: 'ロキ', title_en: 'Loki', premiere_us: '2023-10-05', premiere_jp: '2023-10-06',
      phase: 5, status: 'released', summary_ja: 'c', timeline_order: 46, story_year: '時間外（TVA）', lane: 'thor', essential: true },
    { id: 'daredevil-born-again-s3', type: 'series', canon: 'main', season: 3, title_ja: 'デアデビル:ボーン・アゲイン', title_en: 'Daredevil: Born Again',
      premiere_us: '2027-03', premiere_jp: null, phase: 6, status: 'in_production', summary_ja: 'd', timeline_order: 59, story_year: '2028', lane: 'street', essential: false },
    { id: 'werewolf-by-night', type: 'special', canon: 'main', season: null, title_ja: 'ウェアウルフ・バイ・ナイト', title_en: 'Werewolf by Night',
      premiere_us: '2022-10-07', premiere_jp: null, phase: 4, status: 'released', summary_ja: 'e', timeline_order: 40, story_year: '2025', lane: 'other', essential: false },
    { id: 'what-if-s1', type: 'animated', canon: 'alternate', season: 1, title_ja: 'ホワット・イフ...?', title_en: 'What If...?',
      premiere_us: '2021-08-11', phase: 4, status: 'released', summary_ja: 'f' },
    { id: 'x-men-97-s1', type: 'animated', canon: 'non-mcu', season: 1, title_ja: "X-MEN '97", title_en: "X-Men '97",
      premiere_us: '2024-03-20', phase: 5, status: 'released', summary_ja: 'g' },
  ],
};

test('includedWorks は正史の実写作品だけを公開順で返す', () => {
  const ids = includedWorks(RAW).map((w) => w.id);
  assert.deepEqual(ids, ['iron-man', 'werewolf-by-night', 'loki-s2', 'daredevil-born-again-s3', 'avengers-secret-wars']);
});

test('toWork は映画とドラマの日付フィールドを揃える', () => {
  const film = toWork(RAW.films[0], 'film');
  assert.equal(film.kind, 'film');
  assert.equal(film.dateUs, '2008-05-02');
  assert.equal(film.dateJp, '2008-09-27');
  assert.equal(film.upcoming, false);
  assert.equal(film.posterPath, '/im.jpg');
  assert.equal(film.season, null);
  const series = toWork(RAW.series[0], 'series');
  assert.equal(series.dateUs, '2023-10-05');
  assert.equal(series.season, 2);
  assert.equal(series.posterPath, null);
  assert.equal(toWork(RAW.films[1], 'film').upcoming, true);
  assert.equal(toWork(RAW.series[1], 'series').upcoming, true);
});

test('displayTitle はドラマにだけシーズン番号を付ける', () => {
  assert.equal(displayTitle(toWork(RAW.series[0], 'series')), 'ロキ シーズン2');
  assert.equal(displayTitle(toWork(RAW.films[0], 'film')), 'アイアンマン');
  assert.equal(displayTitle(toWork(RAW.series[2], 'special')), 'ウェアウルフ・バイ・ナイト');
});

test('sortByRelease は月だけの日付と未定を扱い、desc で逆順になる', () => {
  const works = includedWorks(RAW);
  const noDate = { ...works[0], id: 'zzz', dateUs: null };
  const asc = sortByRelease([noDate, ...works]).map((w) => w.id);
  assert.equal(asc[asc.length - 1], 'zzz');
  assert.deepEqual(sortByRelease(works, 'desc').map((w) => w.id), [...works].reverse().map((w) => w.id));
});

test('sortByStory は timeline_order 順', () => {
  const ids = sortByStory(includedWorks(RAW)).map((w) => w.id);
  assert.deepEqual(ids, ['iron-man', 'werewolf-by-night', 'loki-s2', 'daredevil-born-again-s3', 'avengers-secret-wars']);
  assert.equal(sortByStory(includedWorks(RAW), 'desc')[0].id, 'avengers-secret-wars');
});

test('matchesQuery は邦題と原題の部分一致、大文字小文字を無視、空は常に一致', () => {
  const loki = toWork(RAW.series[0], 'series');
  assert.equal(matchesQuery(loki, 'LOKI'), true);
  assert.equal(matchesQuery(loki, 'ロキ'), true);
  assert.equal(matchesQuery(loki, ''), true);
  assert.equal(matchesQuery(loki, '  '), true);
  assert.equal(matchesQuery(loki, 'xyz'), false);
});

test('posterUrl はベースURLとパスをつなぐ。パスがなければ null', () => {
  assert.equal(posterUrl(toWork(RAW.films[0], 'film')), `${POSTER_BASE}/im.jpg`);
  assert.equal(posterUrl(toWork(RAW.series[0], 'series')), null);
});

test('formatDate と dateLabel', () => {
  assert.equal(formatDate('2026-07-31'), '2026年7月31日');
  assert.equal(formatDate('2027-03'), '2027年3月');
  assert.equal(formatDate('2028'), '2028年');
  assert.equal(formatDate(null), null);
  assert.equal(dateLabel(null, true), '未定');
  assert.equal(dateLabel(null, false), '—');
  assert.equal(dateLabel('2021-01-15', false), '2021年1月15日');
});

test('loadJson は失敗時に例外、成功時に JSON を返す', async () => {
  await assert.rejects(loadJson('x.json', async () => ({ ok: false, status: 404 })), /404/);
  assert.deepEqual(await loadJson('x.json', async () => ({ ok: true, json: async () => ({ a: 1 }) })), { a: 1 });
});
