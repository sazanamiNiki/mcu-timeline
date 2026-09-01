# MCU作品カタログサイト 実装計画

<!-- lint-disable -->

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MCU正史の実写映画43件とドラマ・スペシャル20件を、公開順タイムライン・作中時系列タイムライン・依存関係図・ガイドの4タブで表示する静的サイトを作り、GitHub Pagesで公開する。

**Architecture:** ビルド工程のない静的サイト。`index.html` が ES モジュール（`assets/*.js`）を読み込み、`data/*.json` を fetch して描画する。純粋なロジック（正規化・並べ替え・検索・配置計算・祖先探索）は DOM を触らないモジュールに分けて `node --test` で検証し、DOM 描画はブラウザで手動確認する。Python スクリプト（標準ライブラリのみ）でデータ検査・ポスター取得・archify 入力生成を行う。

**Tech Stack:** HTML / CSS / JavaScript (ES modules, ブラウザ実行のみ)、Node.js 22 (`node --test`)、Python 3 (`unittest`, `urllib`)、TMDB API v3、archify (MIT, Node CLI)、GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-08-31-mcu-catalog-design.md`

## Global Constraints

- フレームワークとビルド工程は使わない。JavaScript は ES モジュールで分ける（spec §12）。
- Python スクリプトは標準ライブラリだけで書く（spec §10）。
- 収録は `films` 全件と、`series` のうち `canon == "main"` かつ `type in ("series", "special")` のみ（spec §2）。アニメ・X-MEN '97・旧マーベル・テレビジョン作品は収録しない。
- タブは `#release` `#story` `#graph` `#guide` の4つ（spec §3）。
- 視聴済みは localStorage のキー `mcu-watched` に作品 id の配列で保存。読み書きは try/catch で囲む（spec §8）。
- ポスターは `https://image.tmdb.org/t/p/w342` + `poster_path`。API キーは公開ページに置かない（spec §10）。
- あらすじ `summary_ja` は 45 字以内（spec「40字程度」）。
- ダーク基調、差し色は1色（`--accent: #e62429`）。フェーズの色帯は差し色の明度で区別（spec §13）。
- ポスターは縦横比 2:3、`loading="lazy"`（spec §13）。
- フッターに TMDB のクレジット表記「This product uses the TMDB API but is not endorsed or certified by TMDB.」とデータ更新日を置く（spec §3）。
- archify はノード 12 個以下、ラベルは略称、辺は `fromSide: bottom` / `toSide: top`、品質は `standard`（spec §11）。
- spec §12 の `assets/common.js` は、責務ごとに `data.js`（読込・正規化）、`watched.js`（保存）、`card.js`（カード描画）の3ファイルに分ける。`graph.js` は配置計算を `graph-layout.js` に分ける。責務は spec と同じ。
- ローカル確認は `python3 -m http.server 8000` で `http://localhost:8000/` を開く。
- コミットメッセージの末尾には次の2行を付ける（`-m` を2回追加する）。
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7`
- ユーザーが用意するもの: TMDB API キー（Task 4 の実行時）、GitHub リポジトリ名（Task 14）。未取得なら該当ステップを飛ばし、他のタスクを先に進める。

## File Structure

```
mcu/
├── index.html                 # ページ本体。ヘッダー（検索・タブ）、4つの view セクション、フッター
├── .nojekyll                  # GitHub Pages の Jekyll 処理を止める
├── .gitignore
├── package.json               # "type": "module"、test / check / serve スクリプト
├── README.md                  # ローカル確認・データ更新・公開手順
├── assets/
│   ├── style.css              # 共通スタイル（ダーク、カード、タイムライン、図、ガイド、スマホ）
│   ├── data.js                # 収録判定・Work への正規化・並べ替え・検索・日付整形・JSON 読込（純粋）
│   ├── watched.js             # createWatchedStore(storage): 視聴済みの保存（純粋、storage を注入）
│   ├── card.js                # renderCard(work, opts): 作品カードの DOM
│   ├── timeline.js            # groupWorks / cardState（純粋）と createTimeline（DOM）
│   ├── graph-layout.js        # LANES / layoutGraph / ancestorsOf / edgePath（純粋）
│   ├── graph.js               # createGraph(container, works, edges): SVG 描画・パン・ズーム・強調
│   ├── guide.js               # prepEntries（純粋）と renderGuide（DOM）
│   └── app.js                 # tabFromHash（純粋）、データ読込、タブ・ハッシュ・検索の配線
├── data/
│   ├── mcu-works.json         # 作品データ（既存）。収録対象に timeline_order/story_year/lane/essential/tmdb_id/poster_path を追加
│   ├── dependencies.json      # {"edges":[{"from","to","note"}]} 先に観る作品 → 後に観る作品
│   └── guides.json            # {"prep":[{"target","items":[{"id","note"}]}]} 予習リスト
├── diagrams/
│   ├── src/<target>.architecture.json   # archify 入力（scripts/build_diagrams.py が生成）
│   └── <target>.html                    # archify 出力（コミットする）
├── scripts/
│   ├── check_data.py          # データ整合性の検査。エラーがあれば終了コード 1
│   ├── fetch_posters.py       # TMDB から tmdb_id / poster_path を取得して書き戻す
│   └── build_diagrams.py      # guides.json から archify 入力を生成
└── tests/
    ├── js/*.test.js           # node --test
    └── py/test_*.py           # python3 -m unittest discover -s tests/py
```

---

### Task 1: リポジトリ初期化とデータ検査スクリプトの土台

**Files:**
- Create: `.gitignore`, `.nojekyll`, `package.json`, `scripts/check_data.py`, `tests/py/test_check_data.py`
- Commit（既存）: `data/mcu-works.json`, `research/mcu-research.md`, `docs/superpowers/specs/2026-08-31-mcu-catalog-design.md`, `docs/superpowers/plans/2026-09-01-mcu-catalog.md`

**Interfaces:**
- Produces: `check_data.load(path) -> dict`、`check_data.included(data) -> list[dict]`（films 全件 + 収録対象 series）、`check_data.check_required(data) -> list[str]`、`check_data.check_unique_ids(data) -> list[str]`、`check_data.check_all(data) -> list[str]`、定数 `WORKS_PATH`、`LANES`、`SUMMARY_MAX`。CLI: `python3 scripts/check_data.py` はエラー一覧を出して終了コード 1、なければ `OK: 収録 63 件、依存 0 本`。

- [ ] **Step 1: git 初期化と設定ファイル**

```bash
cd /Users/bunchoniki/claudeCode/mcu
git init -b main
touch .nojekyll
cat > .gitignore <<'EOF'
.DS_Store
node_modules/
__pycache__/
tools/
diagrams/*.visual-check.*
EOF
cat > package.json <<'EOF'
{
  "name": "mcu-catalog",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/js/*.test.js",
    "test:py": "python3 -m unittest discover -s tests/py -p 'test_*.py'",
    "check": "python3 scripts/check_data.py",
    "serve": "python3 -m http.server 8000"
  }
}
EOF
mkdir -p tests/js tests/py scripts
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/py/test_check_data.py`:

```python
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import check_data  # noqa: E402


def sample():
    return {
        'films': [
            {'id': 'iron-man', 'title_ja': 'アイアンマン', 'title_en': 'Iron Man', 'release_us': '2008-05-02',
             'phase': 1, 'summary_ja': 'a', 'status': 'released'},
        ],
        'series': [
            {'id': 'loki-s1', 'type': 'series', 'canon': 'main', 'season': 1, 'title_ja': 'ロキ', 'title_en': 'Loki',
             'premiere_us': '2021-06-09', 'phase': 4, 'summary_ja': 'b', 'status': 'released'},
            {'id': 'what-if-s1', 'type': 'animated', 'canon': 'alternate', 'season': 1, 'title_ja': 'ホワット・イフ...?',
             'title_en': 'What If...?', 'premiere_us': '2021-08-11', 'phase': 4, 'summary_ja': 'c', 'status': 'released'},
        ],
    }


class IncludedTest(unittest.TestCase):
    def test_included_excludes_animated(self):
        ids = [w['id'] for w in check_data.included(sample())]
        self.assertEqual(ids, ['iron-man', 'loki-s1'])


class RequiredTest(unittest.TestCase):
    def test_ok(self):
        self.assertEqual(check_data.check_required(sample()), [])

    def test_missing_title(self):
        d = sample()
        d['films'][0]['title_en'] = ''
        errs = check_data.check_required(d)
        self.assertEqual(len(errs), 1)
        self.assertIn('title_en', errs[0])

    def test_excluded_series_not_checked(self):
        d = sample()
        del d['series'][1]['summary_ja']
        self.assertEqual(check_data.check_required(d), [])

    def test_series_season_must_be_int(self):
        d = sample()
        d['series'][0]['season'] = None
        self.assertTrue(any('season' in e for e in check_data.check_required(d)))


class UniqueTest(unittest.TestCase):
    def test_duplicate_id(self):
        d = sample()
        d['series'].append(dict(d['films'][0]))
        errs = check_data.check_unique_ids(d)
        self.assertEqual(len(errs), 1)
        self.assertIn('iron-man', errs[0])


class RealDataTest(unittest.TestCase):
    def test_real_data_passes(self):
        data = check_data.load(check_data.WORKS_PATH)
        self.assertEqual(check_data.check_all(data), [])
        self.assertEqual(len(check_data.included(data)), 63)


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npm run test:py`
Expected: `ModuleNotFoundError: No module named 'check_data'`

- [ ] **Step 4: check_data.py を書く**

`scripts/check_data.py`:

```python
#!/usr/bin/env python3
"""data/ 配下の JSON の整合性を検査する。エラーがあれば一覧を出力し、終了コード 1 で終わる。"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKS_PATH = ROOT / 'data' / 'mcu-works.json'
DEPS_PATH = ROOT / 'data' / 'dependencies.json'
GUIDES_PATH = ROOT / 'data' / 'guides.json'

INCLUDED_SERIES_TYPES = {'series', 'special'}
FILM_REQUIRED = ('id', 'title_ja', 'title_en', 'release_us', 'phase', 'summary_ja', 'status')
SERIES_REQUIRED = ('id', 'title_ja', 'title_en', 'premiere_us', 'phase', 'summary_ja', 'status', 'type', 'canon')
LANES = ('avengers', 'iron', 'cap', 'thor', 'gotg', 'spidey', 'strange', 'cosmic', 'street', 'antman', 'bp', 'other')
SUMMARY_MAX = 45


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def is_included_series(rec):
    return rec.get('canon') == 'main' and rec.get('type') in INCLUDED_SERIES_TYPES


def included(data):
    return list(data['films']) + [s for s in data['series'] if is_included_series(s)]


def _missing(rec, keys):
    return [k for k in keys if rec.get(k) in (None, '')]


def check_required(data):
    errors = []
    for f in data['films']:
        for k in _missing(f, FILM_REQUIRED):
            errors.append(f"films/{f.get('id', '?')}: {k} が空")
    for s in data['series']:
        if not is_included_series(s):
            continue
        for k in _missing(s, SERIES_REQUIRED):
            errors.append(f"series/{s.get('id', '?')}: {k} が空")
        if s.get('type') == 'series' and not isinstance(s.get('season'), int):
            errors.append(f"series/{s.get('id', '?')}: season が整数でない")
    return errors


def check_unique_ids(data):
    seen, errors = set(), []
    for rec in data['films'] + data['series']:
        if rec['id'] in seen:
            errors.append(f"id が重複: {rec['id']}")
        seen.add(rec['id'])
    return errors


def check_all(data, deps=None, guides=None):
    return check_required(data) + check_unique_ids(data)


def main():
    data = load(WORKS_PATH)
    deps = load(DEPS_PATH) if DEPS_PATH.exists() else None
    guides = load(GUIDES_PATH) if GUIDES_PATH.exists() else None
    errors = check_all(data, deps, guides)
    for e in errors:
        print(e)
    if errors:
        print(f"NG: {len(errors)} 件")
        sys.exit(1)
    print(f"OK: 収録 {len(included(data))} 件、依存 {len(deps['edges']) if deps else 0} 本")


if __name__ == '__main__':
    main()
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm run test:py && python3 scripts/check_data.py`
Expected: `Ran 7 tests ... OK` と `OK: 収録 63 件、依存 0 本`

- [ ] **Step 6: コミット**

```bash
git add .gitignore .nojekyll package.json scripts/check_data.py tests/py/test_check_data.py data research docs
git commit -m "chore: プロジェクト初期化とデータ検査スクリプト" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7"
```

---

### Task 2: 作品メタデータの追加（timeline_order / story_year / lane / essential）とあらすじの短縮

**Files:**
- Modify: `data/mcu-works.json`（収録63件に4フィールドを追加、13件の summary_ja を短縮）
- Modify: `scripts/check_data.py`（`check_metadata` を追加）
- Modify: `tests/py/test_check_data.py`

**Interfaces:**
- Consumes: Task 1 の `check_data.included`、`LANES`、`SUMMARY_MAX`
- Produces: 収録レコードの `timeline_order`（1..63 の連番、Disney+ 公式タイムライン順）、`story_year`（表示用の作中年代）、`lane`（`LANES` のいずれか）、`essential`（真偽値）。`check_data.check_metadata(data) -> list[str]`。`check_all` にこれを含める。

出典: 時系列順は Disney+ の公式タイムライン（2025-11-05 版 + 2026-06-14 更新）。Disney+ に載らない『ノー・ウェイ・ホーム』と各シーズンの分割位置は Rotten Tomatoes のタイムライン順で補った。未配信作は公開順で末尾に置いた。作中年代は英語版 Wikipedia の各フェーズ記事と公式タイムライン本の記述による。

- [ ] **Step 1: 失敗するテストを追加**

`tests/py/test_check_data.py` の `RealDataTest` の前に追加:

```python
class MetadataTest(unittest.TestCase):
    def enriched(self):
        d = sample()
        d['films'][0].update(timeline_order=1, story_year='2008', lane='iron', essential=True)
        d['series'][0].update(timeline_order=2, story_year='時間外（TVA）', lane='thor', essential=False)
        return d

    def test_ok(self):
        self.assertEqual(check_data.check_metadata(self.enriched()), [])

    def test_order_must_be_contiguous(self):
        d = self.enriched()
        d['series'][0]['timeline_order'] = 3
        self.assertTrue(any('連番' in e for e in check_data.check_metadata(d)))

    def test_lane_must_be_known(self):
        d = self.enriched()
        d['films'][0]['lane'] = 'xmen'
        self.assertTrue(any('lane' in e for e in check_data.check_metadata(d)))

    def test_essential_must_be_bool(self):
        d = self.enriched()
        d['films'][0]['essential'] = 'yes'
        self.assertTrue(any('essential' in e for e in check_data.check_metadata(d)))

    def test_summary_length(self):
        d = self.enriched()
        d['films'][0]['summary_ja'] = 'あ' * 46
        self.assertTrue(any('summary_ja' in e for e in check_data.check_metadata(d)))

    def test_real_data(self):
        data = check_data.load(check_data.WORKS_PATH)
        self.assertEqual(check_data.check_metadata(data), [])
```

- [ ] **Step 2: 失敗を確認**

Run: `npm run test:py`
Expected: `AttributeError: module 'check_data' has no attribute 'check_metadata'`

- [ ] **Step 3: check_metadata を実装**

`scripts/check_data.py` の `check_unique_ids` の後に追加し、`check_all` を差し替える:

```python
def check_metadata(data):
    errors = []
    works = included(data)
    orders = []
    for w in works:
        order = w.get('timeline_order')
        if isinstance(order, int):
            orders.append(order)
        else:
            errors.append(f"{w['id']}: timeline_order が整数でない")
        if not w.get('story_year'):
            errors.append(f"{w['id']}: story_year が空")
        if w.get('lane') not in LANES:
            errors.append(f"{w['id']}: lane が不正 ({w.get('lane')})")
        if not isinstance(w.get('essential'), bool):
            errors.append(f"{w['id']}: essential が真偽値でない")
        if len(w.get('summary_ja', '')) > SUMMARY_MAX:
            errors.append(f"{w['id']}: summary_ja が {SUMMARY_MAX} 字を超える ({len(w['summary_ja'])} 字)")
    if sorted(orders) != list(range(1, len(works) + 1)):
        errors.append('timeline_order が 1..N の連番になっていない')
    return errors


def check_all(data, deps=None, guides=None):
    return check_required(data) + check_unique_ids(data) + check_metadata(data)
```

- [ ] **Step 4: メタデータを JSON に書き込む（一回限りのスクリプト。コミットしない）**

```bash
python3 - <<'PY'
import json, pathlib
path = pathlib.Path('data/mcu-works.json')
data = json.loads(path.read_text(encoding='utf-8'))

# id: (timeline_order, story_year, lane, essential)
META = {
 'captain-america-the-first-avenger': (1, '1943–1945', 'cap', False),
 'captain-marvel': (2, '1995', 'cosmic', False),
 'iron-man': (3, '2008', 'iron', True),
 'iron-man-2': (4, '2010', 'iron', False),
 'the-incredible-hulk': (5, '2010', 'other', False),
 'thor': (6, '2010', 'thor', False),
 'the-avengers': (7, '2012', 'avengers', True),
 'thor-the-dark-world': (8, '2013', 'thor', False),
 'iron-man-3': (9, '2012', 'iron', False),
 'captain-america-the-winter-soldier': (10, '2014', 'cap', True),
 'guardians-of-the-galaxy': (11, '2014', 'gotg', True),
 'guardians-of-the-galaxy-vol-2': (12, '2014', 'gotg', False),
 'avengers-age-of-ultron': (13, '2015', 'avengers', True),
 'ant-man': (14, '2015', 'antman', False),
 'captain-america-civil-war': (15, '2016', 'cap', True),
 'black-widow': (16, '2016', 'avengers', False),
 'black-panther': (17, '2016', 'bp', True),
 'spider-man-homecoming': (18, '2016', 'spidey', True),
 'doctor-strange': (19, '2016–2017', 'strange', True),
 'thor-ragnarok': (20, '2017', 'thor', True),
 'ant-man-and-the-wasp': (21, '2018', 'antman', False),
 'avengers-infinity-war': (22, '2018', 'avengers', True),
 'avengers-endgame': (23, '2018–2023', 'avengers', True),
 'loki-s1': (24, '時間外（TVA）', 'thor', True),
 'wandavision': (25, '2023', 'strange', True),
 'shang-chi': (26, '2024', 'other', False),
 'the-falcon-and-the-winter-soldier': (27, '2024', 'cap', False),
 'spider-man-far-from-home': (28, '2024', 'spidey', True),
 'eternals': (29, '2024', 'other', False),
 'spider-man-no-way-home': (30, '2024', 'spidey', True),
 'doctor-strange-multiverse-of-madness': (31, '2024', 'strange', True),
 'hawkeye': (32, '2024', 'street', False),
 'moon-knight': (33, '2025', 'other', False),
 'black-panther-wakanda-forever': (34, '2024–2025', 'bp', False),
 'echo': (35, '2025', 'street', False),
 'she-hulk': (36, '2025', 'street', False),
 'ms-marvel': (37, '2025', 'cosmic', False),
 'thor-love-and-thunder': (38, '2025', 'thor', False),
 'ironheart': (39, '2025', 'iron', False),
 'werewolf-by-night': (40, '2025', 'other', False),
 'gotg-holiday-special': (41, '2025', 'gotg', False),
 'ant-man-and-the-wasp-quantumania': (42, '2026', 'antman', False),
 'guardians-of-the-galaxy-vol-3': (43, '2026', 'gotg', False),
 'secret-invasion': (44, '2026', 'cosmic', False),
 'the-marvels': (45, '2026', 'cosmic', False),
 'loki-s2': (46, '時間外（TVA）', 'thor', True),
 'deadpool-and-wolverine': (47, '2024', 'other', True),
 'agatha-all-along': (48, '2026', 'strange', False),
 'daredevil-born-again-s1': (49, '2026–2027', 'street', False),
 'captain-america-brave-new-world': (50, '2026–2027', 'cap', False),
 'thunderbolts': (51, '2027', 'avengers', True),
 'the-fantastic-four-first-steps': (52, '1964（アース828）', 'other', True),
 'wonder-man': (53, '2025–2027', 'other', False),
 'daredevil-born-again-s2': (54, '2027', 'street', False),
 'the-punisher-one-last-kill': (55, '2027', 'street', False),
 'spider-man-brand-new-day': (56, '2028', 'spidey', True),
 'visionquest': (57, '未発表', 'strange', False),
 'avengers-doomsday': (58, '2028', 'avengers', True),
 'daredevil-born-again-s3': (59, '2028', 'street', False),
 'avengers-secret-wars': (60, '未発表', 'avengers', True),
 'x-men-2028': (61, '未発表', 'other', False),
 'ghost-rider-2028': (62, '未発表', 'other', False),
 'black-panther-3': (63, '未発表', 'bp', False),
}
SUMMARY = {
 'iron-man-2': '正体を公表したトニーの前に、ウィップラッシュとハマーが立ちはだかる。',
 'captain-america-the-winter-soldier': 'S.H.I.E.L.D.に潜むヒドラの陰謀と、ウィンター・ソルジャーの正体を描く。',
 'black-widow': 'シビル・ウォー直後のナターシャが、かつての「家族」と再会しレッドルームと戦う。',
 'spider-man-no-way-home': '正体が知れ渡ったピーターが頼んだ呪文が、マルチバースを開く。歴代スパイダーマンが共演。',
 'deadpool-and-wolverine': 'TVAに目をつけられたデッドプールが、ウルヴァリンと共に世界の消滅を阻止する。',
 'spider-man-brand-new-day': '世界から忘れられたピーターが孤独に街を守る中、新たな脅威と進化した能力に向き合う。',
 'avengers-doomsday': 'ロバート・ダウニー・Jr.演じるドクター・ドゥームを前に、3つの宇宙のヒーローが集結する。',
 'black-panther-3': 'デヴィッド・ジョンソンが、ティ・チャラの息子である新ブラックパンサーを演じる。',
 'daredevil-born-again-s1': '弁護士マット・マードックと、ニューヨーク市長となったキングピンの対決を描く。',
 'wonder-man': 'ヒーロー映画のリメイクの舞台裏を、俳優サイモン・ウィリアムズの視点で風刺的に描く。',
 'daredevil-born-again-s2': '自警活動が違法となったニューヨークで、マットがフィスク市長への抵抗組織を作る。',
 'visionquest': '記憶を取り戻したヴィジョンが、自分に組み込まれたAIたちに答えを求める。三部作の完結編。',
 'daredevil-born-again-s3': 'シーズン2の1年後。正体が公になり投獄されたマットから始まる。',
}
included = data['films'] + [s for s in data['series'] if s.get('canon') == 'main' and s.get('type') in ('series', 'special')]
assert len(included) == 63 and set(META) == {w['id'] for w in included}, '収録対象と META の id が一致しない'
for w in included:
    order, year, lane, essential = META[w['id']]
    w.update(timeline_order=order, story_year=year, lane=lane, essential=essential)
    if w['id'] in SUMMARY:
        w['summary_ja'] = SUMMARY[w['id']]
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('updated', len(included))
PY
```

Expected: `updated 63`

- [ ] **Step 5: テストと検査が通ることを確認**

Run: `npm run test:py && python3 scripts/check_data.py`
Expected: `Ran 13 tests ... OK` と `OK: 収録 63 件、依存 0 本`

- [ ] **Step 6: コミット**

```bash
git add data/mcu-works.json scripts/check_data.py tests/py/test_check_data.py
git commit -m "feat(data): 時系列順・作中年代・レーン・主要作フラグを追加し、あらすじを45字以内に短縮" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7"
```

---

### Task 3: 依存関係とガイドのデータ

**Files:**
- Create: `data/dependencies.json`, `data/guides.json`
- Modify: `scripts/check_data.py`（`find_cycle` / `check_dependencies` / `check_guides` を追加、`check_all` と `main` を更新）
- Modify: `tests/py/test_check_data.py`

**Interfaces:**
- Consumes: Task 2 の収録レコード（id）
- Produces: `data/dependencies.json` = `{"edges": [{"from": id, "to": id, "note": str}]}`（from を先に観る）。`data/guides.json` = `{"prep": [{"target": id, "items": [{"id": id, "note": str}]}]}`。`check_data.find_cycle(graph: dict[str, list[str]]) -> list[str] | None`、`check_dependencies(data, deps) -> list[str]`、`check_guides(data, guides) -> list[str]`。

- [ ] **Step 1: 失敗するテストを追加**

`tests/py/test_check_data.py` の `RealDataTest` の前に追加:

```python
class DependencyTest(unittest.TestCase):
    def test_cycle_detected(self):
        self.assertEqual(check_data.find_cycle({'a': ['b'], 'b': ['a']}), ['a', 'b', 'a'])

    def test_no_cycle(self):
        self.assertIsNone(check_data.find_cycle({'a': ['b'], 'b': ['c']}))

    def test_unknown_id(self):
        deps = {'edges': [{'from': 'iron-man', 'to': 'nope', 'note': 'x'}]}
        errs = check_data.check_dependencies(sample(), deps)
        self.assertTrue(any('nope' in e for e in errs))

    def test_duplicate_and_self(self):
        deps = {'edges': [
            {'from': 'iron-man', 'to': 'loki-s1', 'note': 'x'},
            {'from': 'iron-man', 'to': 'loki-s1', 'note': 'x'},
            {'from': 'loki-s1', 'to': 'loki-s1', 'note': 'x'},
        ]}
        errs = check_data.check_dependencies(sample(), deps)
        self.assertTrue(any('重複' in e for e in errs))
        self.assertTrue(any('自己参照' in e for e in errs))

    def test_empty_note(self):
        deps = {'edges': [{'from': 'iron-man', 'to': 'loki-s1', 'note': ''}]}
        self.assertTrue(any('note' in e for e in check_data.check_dependencies(sample(), deps)))

    def test_real_data(self):
        data = check_data.load(check_data.WORKS_PATH)
        deps = check_data.load(check_data.DEPS_PATH)
        guides = check_data.load(check_data.GUIDES_PATH)
        self.assertEqual(check_data.check_dependencies(data, deps), [])
        self.assertEqual(check_data.check_guides(data, guides), [])
        self.assertEqual(len(deps['edges']), 104)


class GuideTest(unittest.TestCase):
    def test_unknown_target(self):
        guides = {'prep': [{'target': 'nope', 'items': [{'id': 'iron-man', 'note': 'x'}]}]}
        self.assertTrue(any('nope' in e for e in check_data.check_guides(sample(), guides)))

    def test_unknown_item(self):
        guides = {'prep': [{'target': 'loki-s1', 'items': [{'id': 'nope', 'note': 'x'}]}]}
        self.assertTrue(any('nope' in e for e in check_data.check_guides(sample(), guides)))
```

- [ ] **Step 2: 失敗を確認**

Run: `npm run test:py`
Expected: `AttributeError: module 'check_data' has no attribute 'find_cycle'`

- [ ] **Step 3: 検査関数を実装**

`scripts/check_data.py` の `check_metadata` の後に追加し、`check_all` を差し替える:

```python
def find_cycle(graph):
    """有向グラフの循環を1つ返す（例: ['a', 'b', 'a']）。なければ None。"""
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {}
    stack = []

    def visit(node):
        color[node] = GRAY
        stack.append(node)
        for nxt in graph.get(node, []):
            state = color.get(nxt, WHITE)
            if state == GRAY:
                return stack[stack.index(nxt):] + [nxt]
            if state == WHITE:
                found = visit(nxt)
                if found:
                    return found
        stack.pop()
        color[node] = BLACK
        return None

    for node in list(graph):
        if color.get(node, WHITE) == WHITE:
            found = visit(node)
            if found:
                return found
    return None


def check_dependencies(data, deps):
    errors = []
    ids = {w['id'] for w in included(data)}
    seen = set()
    graph = {}
    for e in deps['edges']:
        a, b = e.get('from'), e.get('to')
        if a not in ids:
            errors.append(f"dependencies: from が未収録 ({a})")
        if b not in ids:
            errors.append(f"dependencies: to が未収録 ({b})")
        if a == b:
            errors.append(f"dependencies: 自己参照 ({a})")
        if (a, b) in seen:
            errors.append(f"dependencies: 重複 ({a} -> {b})")
        seen.add((a, b))
        if not e.get('note'):
            errors.append(f"dependencies: note が空 ({a} -> {b})")
        graph.setdefault(a, []).append(b)
    cycle = find_cycle(graph)
    if cycle:
        errors.append('dependencies: 循環 ' + ' -> '.join(cycle))
    return errors


def check_guides(data, guides):
    errors = []
    ids = {w['id'] for w in included(data)}
    for g in guides['prep']:
        target = g.get('target')
        if target not in ids:
            errors.append(f"guides: target が未収録 ({target})")
        for item in g.get('items', []):
            if item.get('id') not in ids:
                errors.append(f"guides/{target}: id が未収録 ({item.get('id')})")
            if not item.get('note'):
                errors.append(f"guides/{target}: note が空 ({item.get('id')})")
    return errors


def check_all(data, deps=None, guides=None):
    errors = check_required(data) + check_unique_ids(data) + check_metadata(data)
    if deps is not None:
        errors += check_dependencies(data, deps)
    if guides is not None:
        errors += check_guides(data, guides)
    return errors
```

- [ ] **Step 4: dependencies.json を書く**

`data/dependencies.json`（104本。from を先に観る。note は理由の一言）:

```json
{
  "edges": [
    {"from": "iron-man", "to": "iron-man-2", "note": "トニーの続きの物語"},
    {"from": "iron-man", "to": "the-avengers", "note": "アイアンマンの原点"},
    {"from": "the-incredible-hulk", "to": "captain-america-brave-new-world", "note": "ロス将軍とハルクの因縁"},
    {"from": "the-incredible-hulk", "to": "she-hulk", "note": "ブルースの過去"},
    {"from": "iron-man-2", "to": "the-avengers", "note": "ナターシャとS.H.I.E.L.D."},
    {"from": "thor", "to": "the-avengers", "note": "ソーとロキの関係"},
    {"from": "thor", "to": "thor-the-dark-world", "note": "ソーの続編"},
    {"from": "captain-america-the-first-avenger", "to": "the-avengers", "note": "スティーブの原点"},
    {"from": "captain-america-the-first-avenger", "to": "captain-america-the-winter-soldier", "note": "バッキーとペギー"},
    {"from": "the-avengers", "to": "iron-man-3", "note": "ニューヨーク決戦の後遺症"},
    {"from": "the-avengers", "to": "thor-the-dark-world", "note": "ロキの投獄"},
    {"from": "the-avengers", "to": "captain-america-the-winter-soldier", "note": "S.H.I.E.L.D.の内情"},
    {"from": "the-avengers", "to": "avengers-age-of-ultron", "note": "チームの続き"},
    {"from": "the-avengers", "to": "loki-s1", "note": "四次元キューブの逃亡"},
    {"from": "iron-man-3", "to": "avengers-age-of-ultron", "note": "トニーの不安と決断"},
    {"from": "iron-man-3", "to": "wonder-man", "note": "トレヴァー・スラッタリー"},
    {"from": "thor-the-dark-world", "to": "thor-ragnarok", "note": "ロキの玉座"},
    {"from": "captain-america-the-winter-soldier", "to": "avengers-age-of-ultron", "note": "S.H.I.E.L.D.崩壊後"},
    {"from": "captain-america-the-winter-soldier", "to": "captain-america-civil-war", "note": "バッキーの行方"},
    {"from": "captain-america-the-winter-soldier", "to": "the-falcon-and-the-winter-soldier", "note": "サムとバッキー"},
    {"from": "guardians-of-the-galaxy", "to": "guardians-of-the-galaxy-vol-2", "note": "ガーディアンズ結成"},
    {"from": "guardians-of-the-galaxy", "to": "avengers-infinity-war", "note": "ストーンとサノス"},
    {"from": "avengers-age-of-ultron", "to": "captain-america-civil-war", "note": "ソコヴィアの惨事"},
    {"from": "avengers-age-of-ultron", "to": "wandavision", "note": "ヴィジョン誕生"},
    {"from": "avengers-age-of-ultron", "to": "thor-ragnarok", "note": "ソーの幻視"},
    {"from": "avengers-age-of-ultron", "to": "avengers-infinity-war", "note": "マインド・ストーン"},
    {"from": "avengers-age-of-ultron", "to": "visionquest", "note": "ウルトロン"},
    {"from": "ant-man", "to": "captain-america-civil-war", "note": "スコットの参戦"},
    {"from": "ant-man", "to": "ant-man-and-the-wasp", "note": "量子世界"},
    {"from": "captain-america-civil-war", "to": "spider-man-homecoming", "note": "ピーターの初登場"},
    {"from": "captain-america-civil-war", "to": "black-panther", "note": "ティ・チャラの即位"},
    {"from": "captain-america-civil-war", "to": "avengers-infinity-war", "note": "分裂したチーム"},
    {"from": "captain-america-civil-war", "to": "black-widow", "note": "直後の逃亡"},
    {"from": "doctor-strange", "to": "thor-ragnarok", "note": "ストレンジの登場"},
    {"from": "doctor-strange", "to": "avengers-infinity-war", "note": "タイム・ストーン"},
    {"from": "doctor-strange", "to": "doctor-strange-multiverse-of-madness", "note": "ストレンジの続編"},
    {"from": "doctor-strange", "to": "spider-man-no-way-home", "note": "呪文の依頼"},
    {"from": "guardians-of-the-galaxy-vol-2", "to": "avengers-infinity-war", "note": "ガーディアンズの合流"},
    {"from": "guardians-of-the-galaxy-vol-2", "to": "guardians-of-the-galaxy-vol-3", "note": "家族の物語"},
    {"from": "guardians-of-the-galaxy-vol-2", "to": "thor-love-and-thunder", "note": "ソーとの同行"},
    {"from": "spider-man-homecoming", "to": "spider-man-far-from-home", "note": "ピーターの続編"},
    {"from": "spider-man-homecoming", "to": "avengers-infinity-war", "note": "アイアン・スパイダー"},
    {"from": "thor-ragnarok", "to": "avengers-infinity-war", "note": "冒頭に直結"},
    {"from": "thor-ragnarok", "to": "thor-love-and-thunder", "note": "ソーの続編"},
    {"from": "black-panther", "to": "avengers-infinity-war", "note": "ワカンダの戦い"},
    {"from": "black-panther", "to": "black-panther-wakanda-forever", "note": "ワカンダの続編"},
    {"from": "avengers-infinity-war", "to": "avengers-endgame", "note": "前後編"},
    {"from": "avengers-infinity-war", "to": "ant-man-and-the-wasp", "note": "指パッチンの瞬間"},
    {"from": "avengers-infinity-war", "to": "captain-marvel", "note": "ポケベルの呼び出し"},
    {"from": "ant-man-and-the-wasp", "to": "avengers-endgame", "note": "量子世界の鍵"},
    {"from": "ant-man-and-the-wasp", "to": "ant-man-and-the-wasp-quantumania", "note": "ラング一家の続編"},
    {"from": "captain-marvel", "to": "avengers-endgame", "note": "キャロルの参戦"},
    {"from": "captain-marvel", "to": "the-marvels", "note": "キャロルの続編"},
    {"from": "captain-marvel", "to": "ms-marvel", "note": "カマラの憧れ"},
    {"from": "captain-marvel", "to": "secret-invasion", "note": "スクラルとフューリー"},
    {"from": "avengers-endgame", "to": "spider-man-far-from-home", "note": "トニー亡き後"},
    {"from": "avengers-endgame", "to": "wandavision", "note": "ワンダの喪失"},
    {"from": "avengers-endgame", "to": "the-falcon-and-the-winter-soldier", "note": "盾の継承"},
    {"from": "avengers-endgame", "to": "loki-s1", "note": "逃げたロキ"},
    {"from": "avengers-endgame", "to": "hawkeye", "note": "ローニンの過去"},
    {"from": "avengers-endgame", "to": "thor-love-and-thunder", "note": "ソーの再出発"},
    {"from": "spider-man-far-from-home", "to": "spider-man-no-way-home", "note": "正体の暴露"},
    {"from": "black-widow", "to": "hawkeye", "note": "エレーナの復讐"},
    {"from": "black-widow", "to": "thunderbolts", "note": "エレーナとレッドガーディアン"},
    {"from": "shang-chi", "to": "wonder-man", "note": "トレヴァー・スラッタリー"},
    {"from": "shang-chi", "to": "avengers-doomsday", "note": "シャン・チーの参戦"},
    {"from": "wandavision", "to": "doctor-strange-multiverse-of-madness", "note": "ワンダの変貌"},
    {"from": "wandavision", "to": "agatha-all-along", "note": "アガサの正体"},
    {"from": "wandavision", "to": "visionquest", "note": "ホワイトヴィジョン"},
    {"from": "the-falcon-and-the-winter-soldier", "to": "captain-america-brave-new-world", "note": "新キャプテン・アメリカ"},
    {"from": "the-falcon-and-the-winter-soldier", "to": "thunderbolts", "note": "ジョン・ウォーカー"},
    {"from": "loki-s1", "to": "loki-s2", "note": "続きの物語"},
    {"from": "loki-s1", "to": "ant-man-and-the-wasp-quantumania", "note": "征服者カーン"},
    {"from": "loki-s1", "to": "deadpool-and-wolverine", "note": "TVA"},
    {"from": "hawkeye", "to": "echo", "note": "マヤの物語"},
    {"from": "hawkeye", "to": "daredevil-born-again-s1", "note": "キングピンの再登場"},
    {"from": "ms-marvel", "to": "the-marvels", "note": "カマラの参戦"},
    {"from": "gotg-holiday-special", "to": "guardians-of-the-galaxy-vol-3", "note": "直前の出来事"},
    {"from": "secret-invasion", "to": "the-marvels", "note": "フューリーの現状"},
    {"from": "loki-s2", "to": "deadpool-and-wolverine", "note": "時間線の管理"},
    {"from": "loki-s2", "to": "avengers-doomsday", "note": "ロキの役割"},
    {"from": "echo", "to": "daredevil-born-again-s1", "note": "キングピンの復帰"},
    {"from": "agatha-all-along", "to": "visionquest", "note": "三部作の2作目"},
    {"from": "daredevil-born-again-s1", "to": "daredevil-born-again-s2", "note": "続きの物語"},
    {"from": "daredevil-born-again-s1", "to": "spider-man-brand-new-day", "note": "パニッシャー"},
    {"from": "daredevil-born-again-s2", "to": "the-punisher-one-last-kill", "note": "同時期の物語"},
    {"from": "daredevil-born-again-s2", "to": "daredevil-born-again-s3", "note": "続きの物語"},
    {"from": "black-panther-wakanda-forever", "to": "ironheart", "note": "リリの登場"},
    {"from": "black-panther-wakanda-forever", "to": "avengers-doomsday", "note": "シュリとネイモア"},
    {"from": "black-panther-wakanda-forever", "to": "black-panther-3", "note": "息子の登場"},
    {"from": "the-fantastic-four-first-steps", "to": "avengers-doomsday", "note": "ドゥーム初登場"},
    {"from": "thunderbolts", "to": "avengers-doomsday", "note": "ニュー・アベンジャーズ"},
    {"from": "captain-america-brave-new-world", "to": "avengers-doomsday", "note": "サムのキャプテン"},
    {"from": "spider-man-no-way-home", "to": "spider-man-brand-new-day", "note": "忘れられたピーター"},
    {"from": "spider-man-no-way-home", "to": "doctor-strange-multiverse-of-madness", "note": "呪文の余波"},
    {"from": "spider-man-brand-new-day", "to": "avengers-doomsday", "note": "直前の物語"},
    {"from": "spider-man-brand-new-day", "to": "x-men-2028", "note": "ジーン・グレイ"},
    {"from": "deadpool-and-wolverine", "to": "avengers-doomsday", "note": "X-MENの合流"},
    {"from": "doctor-strange-multiverse-of-madness", "to": "avengers-doomsday", "note": "マルチバースの衝突"},
    {"from": "thor-love-and-thunder", "to": "avengers-doomsday", "note": "ソーの現状"},
    {"from": "eternals", "to": "captain-america-brave-new-world", "note": "セレスティアルの島"},
    {"from": "ant-man-and-the-wasp-quantumania", "to": "avengers-doomsday", "note": "スコットとキャシー"},
    {"from": "avengers-doomsday", "to": "avengers-secret-wars", "note": "前後編"},
    {"from": "avengers-secret-wars", "to": "x-men-2028", "note": "サーガの後の世界"}
  ]
}
```

- [ ] **Step 5: guides.json を書く**

`data/guides.json`:

```json
{
  "prep": [
    {
      "target": "visionquest",
      "items": [
        {"id": "avengers-age-of-ultron", "note": "ヴィジョンの誕生とウルトロン"},
        {"id": "captain-america-civil-war", "note": "ヴィジョンとワンダの関係"},
        {"id": "avengers-infinity-war", "note": "ヴィジョンの死"},
        {"id": "wandavision", "note": "ホワイトヴィジョンの誕生"},
        {"id": "agatha-all-along", "note": "三部作の2作目"}
      ]
    },
    {
      "target": "avengers-doomsday",
      "items": [
        {"id": "doctor-strange-multiverse-of-madness", "note": "マルチバースの衝突"},
        {"id": "thor-love-and-thunder", "note": "ソーの現状"},
        {"id": "black-panther-wakanda-forever", "note": "ワカンダとネイモア"},
        {"id": "loki-s2", "note": "時間線とロキの役割"},
        {"id": "deadpool-and-wolverine", "note": "X-MENとマルチバース"},
        {"id": "captain-america-brave-new-world", "note": "新キャプテン・アメリカ"},
        {"id": "thunderbolts", "note": "ニュー・アベンジャーズの結成"},
        {"id": "the-fantastic-four-first-steps", "note": "ドクター・ドゥームの初登場"},
        {"id": "spider-man-brand-new-day", "note": "直前の物語"}
      ]
    }
  ]
}
```

- [ ] **Step 6: テストと検査が通ることを確認**

Run: `npm run test:py && python3 scripts/check_data.py`
Expected: `Ran 21 tests ... OK` と `OK: 収録 63 件、依存 104 本`

- [ ] **Step 7: コミット**

```bash
git add data/dependencies.json data/guides.json scripts/check_data.py tests/py/test_check_data.py
git commit -m "feat(data): 依存関係104本と予習リストを追加し、循環と参照を検査" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7"
```

---

### Task 4: ポスター取得スクリプト（TMDB）

**Files:**
- Create: `scripts/fetch_posters.py`, `tests/py/test_fetch_posters.py`
- Modify（実行時）: `data/mcu-works.json`（`tmdb_id` と `poster_path` を追加）

**Interfaces:**
- Consumes: Task 2 の収録レコード（`title_en`、`release_us` / `premiere_us`、`type`、`season`）
- Produces: `fetch_posters.search_params(work, api_key, language) -> (path, params)`、`pick_result(results) -> dict | None`、`resolve(work, api_key, get_json) -> (tmdb_id, poster_path | None) | None`、`fetch_by_id(work, api_key, get_json) -> (tmdb_id, poster_path | None)`。CLI: `TMDB_API_KEY=... python3 scripts/fetch_posters.py` が収録レコードに `tmdb_id` / `poster_path` を書き戻し、未解決の id を表示する。

- [ ] **Step 1: 失敗するテストを書く**

`tests/py/test_fetch_posters.py`:

```python
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import fetch_posters  # noqa: E402

FILM = {'id': 'iron-man', 'title_en': 'Iron Man', 'release_us': '2008-05-02'}


class SearchParamsTest(unittest.TestCase):
    def test_film_uses_movie_search_with_year(self):
        path, params = fetch_posters.search_params(FILM, 'K', 'ja-JP')
        self.assertEqual(path, '/search/movie')
        self.assertEqual(params['year'], '2008')
        self.assertEqual(params['language'], 'ja-JP')
        self.assertEqual(params['query'], 'Iron Man')

    def test_special_uses_movie_search(self):
        work = {'id': 'werewolf-by-night', 'title_en': 'Werewolf by Night', 'type': 'special', 'premiere_us': '2022-10-07', 'season': None}
        path, params = fetch_posters.search_params(work, 'K', 'ja-JP')
        self.assertEqual(path, '/search/movie')
        self.assertEqual(params['year'], '2022')

    def test_series_season1_uses_tv_search_with_year(self):
        work = {'id': 'loki-s1', 'title_en': 'Loki', 'type': 'series', 'premiere_us': '2021-06-09', 'season': 1}
        path, params = fetch_posters.search_params(work, 'K', 'ja-JP')
        self.assertEqual(path, '/search/tv')
        self.assertEqual(params['first_air_date_year'], '2021')

    def test_series_later_season_omits_year(self):
        work = {'id': 'loki-s2', 'title_en': 'Loki', 'type': 'series', 'premiere_us': '2023-10-05', 'season': 2}
        path, params = fetch_posters.search_params(work, 'K', 'ja-JP')
        self.assertEqual(path, '/search/tv')
        self.assertNotIn('first_air_date_year', params)


class PickResultTest(unittest.TestCase):
    def test_prefers_result_with_poster(self):
        results = [{'id': 1, 'poster_path': None}, {'id': 2, 'poster_path': '/b.jpg'}]
        self.assertEqual(fetch_posters.pick_result(results)['id'], 2)

    def test_first_when_no_poster(self):
        self.assertEqual(fetch_posters.pick_result([{'id': 1, 'poster_path': None}])['id'], 1)

    def test_none_when_empty(self):
        self.assertIsNone(fetch_posters.pick_result([]))


class ResolveTest(unittest.TestCase):
    def test_prefers_japanese_poster(self):
        calls = []

        def fake(url):
            calls.append(url)
            return {'results': [{'id': 1726, 'poster_path': '/ja.jpg'}]}

        self.assertEqual(fetch_posters.resolve(FILM, 'K', fake), (1726, '/ja.jpg'))
        self.assertEqual(len(calls), 1)
        self.assertIn('language=ja-JP', calls[0])
        self.assertIn('api_key=K', calls[0])

    def test_falls_back_to_english_poster(self):
        calls = []

        def fake(url):
            calls.append(url)
            if 'language=ja-JP' in url:
                return {'results': [{'id': 1726, 'poster_path': None}]}
            return {'results': [{'id': 1726, 'poster_path': '/en.jpg'}]}

        self.assertEqual(fetch_posters.resolve(FILM, 'K', fake), (1726, '/en.jpg'))
        self.assertIn('language=en-US', calls[1])

    def test_none_when_no_results(self):
        self.assertIsNone(fetch_posters.resolve(FILM, 'K', lambda url: {'results': []}))


class FetchByIdTest(unittest.TestCase):
    def test_uses_tv_endpoint_for_series(self):
        calls = []

        def fake(url):
            calls.append(url)
            return {'poster_path': '/p.jpg'}

        work = {'id': 'loki-s1', 'tmdb_id': 84958, 'type': 'series', 'premiere_us': '2021-06-09', 'season': 1}
        self.assertEqual(fetch_posters.fetch_by_id(work, 'K', fake), (84958, '/p.jpg'))
        self.assertIn('/tv/84958?', calls[0])

    def test_uses_movie_endpoint_for_film_and_falls_back(self):
        calls = []

        def fake(url):
            calls.append(url)
            return {'poster_path': None}

        work = dict(FILM, tmdb_id=1726)
        self.assertEqual(fetch_posters.fetch_by_id(work, 'K', fake), (1726, None))
        self.assertIn('/movie/1726?', calls[0])
        self.assertEqual(len(calls), 2)


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: 失敗を確認**

Run: `npm run test:py`
Expected: `ModuleNotFoundError: No module named 'fetch_posters'`

- [ ] **Step 3: fetch_posters.py を書く**

`scripts/fetch_posters.py`:

```python
#!/usr/bin/env python3
"""TMDB から作品の ID とポスターのパスを取得し、data/mcu-works.json に書き戻す。

使い方:
    TMDB_API_KEY=xxxx python3 scripts/fetch_posters.py

標準ライブラリだけで動く。poster_path が既にある作品は飛ばす。
tmdb_id だけがある作品は、その ID で直接ポスターを取りに行く。
"""
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKS_PATH = ROOT / 'data' / 'mcu-works.json'
API = 'https://api.themoviedb.org/3'
INCLUDED_SERIES_TYPES = {'series', 'special'}
LANGUAGES = ('ja-JP', 'en-US')


def build_url(path, params):
    return f"{API}{path}?{urllib.parse.urlencode(params)}"


def http_get_json(url):
    with urllib.request.urlopen(url, timeout=20) as res:
        return json.load(res)


def is_film(work):
    return 'release_us' in work


def is_movie_like(work):
    """TMDB 上で「映画」として登録されている作品か。スペシャルはTV映画として映画側にある。"""
    return is_film(work) or work.get('type') == 'special'


def search_params(work, api_key, language):
    """検索のパスとパラメータを返す。映画とスペシャルは search/movie、ドラマは search/tv。"""
    base = {'api_key': api_key, 'language': language, 'query': work['title_en'], 'include_adult': 'false'}
    if is_film(work):
        return '/search/movie', {**base, 'year': work['release_us'][:4]}
    if work.get('type') == 'special':
        return '/search/movie', {**base, 'year': work['premiere_us'][:4]}
    if work.get('season') in (None, 1) and work.get('premiere_us'):
        return '/search/tv', {**base, 'first_air_date_year': work['premiere_us'][:4]}
    return '/search/tv', base


def pick_result(results):
    """ポスターのある結果を優先し、なければ先頭を返す。空なら None。"""
    for r in results:
        if r.get('poster_path'):
            return r
    return results[0] if results else None


def resolve(work, api_key, get_json=http_get_json):
    """(tmdb_id, poster_path) を返す。見つからなければ None。日本語のポスターを優先し、なければ英語。"""
    path, params = search_params(work, api_key, LANGUAGES[0])
    hit = pick_result(get_json(build_url(path, params)).get('results', []))
    if hit is None:
        return None
    poster = hit.get('poster_path')
    if not poster:
        en = get_json(build_url(path, {**params, 'language': LANGUAGES[1]}))
        en_hit = next((r for r in en.get('results', []) if r.get('id') == hit['id']), None)
        poster = en_hit.get('poster_path') if en_hit else None
    return hit['id'], poster


def fetch_by_id(work, api_key, get_json=http_get_json):
    """tmdb_id が分かっている作品のポスターを取る。日本語→英語の順に試す。"""
    kind = 'movie' if is_movie_like(work) else 'tv'
    for language in LANGUAGES:
        detail = get_json(build_url(f"/{kind}/{work['tmdb_id']}", {'api_key': api_key, 'language': language}))
        if detail.get('poster_path'):
            return work['tmdb_id'], detail['poster_path']
    return work['tmdb_id'], None


def included(data):
    return list(data['films']) + [s for s in data['series'] if s.get('canon') == 'main' and s.get('type') in INCLUDED_SERIES_TYPES]


def main():
    api_key = os.environ.get('TMDB_API_KEY')
    if not api_key:
        print('環境変数 TMDB_API_KEY を設定してください', file=sys.stderr)
        sys.exit(2)
    data = json.loads(WORKS_PATH.read_text(encoding='utf-8'))
    unresolved = []
    for work in included(data):
        if work.get('poster_path'):
            continue
        found = fetch_by_id(work, api_key) if work.get('tmdb_id') else resolve(work, api_key)
        if found is None:
            unresolved.append(work['id'])
            continue
        work['tmdb_id'], poster = found
        if poster:
            work['poster_path'] = poster
            print(f"{work['id']}: {work['tmdb_id']} {poster}")
        else:
            unresolved.append(work['id'])
    WORKS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if unresolved:
        print('未解決:', ', '.join(unresolved))
        print('該当作品の tmdb_id を手で入れて再実行してください（https://www.themoviedb.org/ で検索）')


if __name__ == '__main__':
    main()
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:py`
Expected: `Ran 33 tests ... OK`

- [ ] **Step 5: コミット**

```bash
git add scripts/fetch_posters.py tests/py/test_fetch_posters.py
git commit -m "feat(scripts): TMDB からポスターを取得するスクリプト" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7"
```

- [ ] **Step 6: 実行（ユーザーの TMDB API キーが必要。未取得ならこのステップを飛ばし、キー取得後に戻る）**

```bash
TMDB_API_KEY='ユーザーから受け取ったキー' python3 scripts/fetch_posters.py
python3 scripts/check_data.py
```

Expected: 収録作品ごとに `id: tmdb_id /xxxx.jpg` が並ぶ。「未解決:」に出た作品は TMDB で検索して `tmdb_id` を該当レコードに手で入れ、再実行する。未公開作（2028年の3本など）は TMDB に登録がないこともある。その場合は未解決のままでよく、ページ側はプレースホルダーを出す。

```bash
git add data/mcu-works.json
git commit -m "feat(data): TMDB のポスターと ID を追加" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7"
```

---

### Task 5: data.js（収録判定・正規化・並べ替え・検索・日付整形・JSON 読込）

**Files:**
- Create: `assets/data.js`, `tests/js/data.test.js`

**Interfaces:**
- Consumes: `data/mcu-works.json` の生レコード
- Produces（すべて純粋関数）:
  - `Work` 型: `{ id, kind: 'film'|'series'|'special', titleJa, titleEn, season: number|null, phase: number, dateUs: string|null, dateJp: string|null, summary, upcoming: boolean, timelineOrder: number, storyYear: string, lane: string, essential: boolean, posterPath: string|null }`
  - `isIncludedSeries(raw)`, `toWork(raw, kind) -> Work`, `includedWorks(data) -> Work[]`（公開順）
  - `releaseKey(work) -> string`, `sortByRelease(works, dir='asc'|'desc')`, `sortByStory(works, dir)`
  - `displayTitle(work)`（ドラマは「シーズンN」付き）, `matchesQuery(work, query)`, `posterUrl(work) -> string|null`
  - `formatDate(iso) -> string|null`, `dateLabel(iso, upcoming) -> string`
  - `loadJson(url, fetchFn=globalThis.fetch) -> Promise<any>`（`!res.ok` で例外）
  - 定数 `POSTER_BASE`, `KIND_LABELS`, `phaseLabel(n)`

- [ ] **Step 1: 失敗するテストを書く**

`tests/js/data.test.js`:

```js
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
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test`
Expected: `Cannot find module '.../assets/data.js'`

- [ ] **Step 3: data.js を書く**

`assets/data.js`:

```js
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: `# pass 9` / `# fail 0`

- [ ] **Step 5: コミット**

```bash
git add assets/data.js tests/js/data.test.js
git commit -m "feat(assets): 作品データの正規化・並べ替え・検索モジュール" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7"
```

---

### Task 6: watched.js（視聴済みの保存）

**Files:**
- Create: `assets/watched.js`, `tests/js/watched.test.js`

**Interfaces:**
- Produces: `STORAGE_KEY = 'mcu-watched'`、`createWatchedStore(storage) -> { available: boolean, has(id) -> boolean, toggle(id) -> boolean（切り替え後の状態）, ids() -> string[] }`。`storage` は `localStorage` 互換（`getItem` / `setItem` / `removeItem`）か `null`。読めない・書けない・壊れている場合も例外を投げず、`available` を `false` にする。

- [ ] **Step 1: 失敗するテストを書く**

`tests/js/watched.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatchedStore, STORAGE_KEY } from '../../assets/watched.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

test('toggle は追加と削除を切り替え、JSON 配列で保存する', () => {
  const storage = fakeStorage();
  const store = createWatchedStore(storage);
  assert.equal(store.available, true);
  assert.equal(store.has('iron-man'), false);
  assert.equal(store.toggle('iron-man'), true);
  assert.equal(store.has('iron-man'), true);
  assert.deepEqual(JSON.parse(storage.dump()[STORAGE_KEY]), ['iron-man']);
  assert.equal(store.toggle('iron-man'), false);
  assert.deepEqual(store.ids(), []);
});

test('保存済みの配列を読み込む', () => {
  const store = createWatchedStore(fakeStorage({ [STORAGE_KEY]: '["thor","loki-s1"]' }));
  assert.deepEqual(store.ids().sort(), ['loki-s1', 'thor']);
});

test('壊れた JSON は空として扱う', () => {
  const store = createWatchedStore(fakeStorage({ [STORAGE_KEY]: '{oops' }));
  assert.equal(store.available, true);
  assert.deepEqual(store.ids(), []);
});

test('storage が null なら available=false で、toggle は例外を投げない', () => {
  const store = createWatchedStore(null);
  assert.equal(store.available, false);
  assert.doesNotThrow(() => store.toggle('iron-man'));
});

test('setItem が例外を投げる storage は available=false', () => {
  const throwing = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => {} };
  const store = createWatchedStore(throwing);
  assert.equal(store.available, false);
  assert.doesNotThrow(() => store.toggle('iron-man'));
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test`
Expected: `Cannot find module '.../assets/watched.js'`

- [ ] **Step 3: watched.js を書く**

`assets/watched.js`:

```js
// 視聴済みの保存。localStorage 互換の storage を注入する。DOM に依存しない。

export const STORAGE_KEY = 'mcu-watched';
const PROBE_KEY = '__mcu_probe__';

function readIds(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function createWatchedStore(storage) {
  let available = false;
  let ids = new Set();
  try {
    if (storage) {
      storage.setItem(PROBE_KEY, '1');
      storage.removeItem(PROBE_KEY);
      available = true;
      ids = new Set(readIds(storage));
    }
  } catch {
    available = false;
  }

  function persist() {
    if (!available) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
      available = false;
    }
  }

  return {
    get available() {
      return available;
    },
    has: (id) => ids.has(id),
    toggle(id) {
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      persist();
      return ids.has(id);
    },
    ids: () => [...ids],
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: `# pass 14` / `# fail 0`

- [ ] **Step 5: コミット**

```bash
git add assets/watched.js tests/js/watched.test.js
git commit -m "feat(assets): 視聴済みを localStorage に保存するストア" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7"
```

---

### Task 7: ページの骨組み（index.html / style.css / card.js / app.js のタブとハッシュ）

**Files:**
- Create: `index.html`, `assets/style.css`, `assets/card.js`, `assets/app.js`, `tests/js/app.test.js`

**Interfaces:**
- Consumes: Task 5 の `loadJson`, `includedWorks`, `displayTitle`, `dateLabel`, `posterUrl`, `KIND_LABELS`, `phaseLabel`。Task 6 の `createWatchedStore`
- Produces: `card.renderCard(work, { store, onChange, compact = false }) -> HTMLElement`（`article.card[data-id][data-phase]`、`card--compact` / `card--upcoming` / `card--essential` クラス）。`app.TABS`、`app.tabFromHash(hash) -> 'release'|'story'|'graph'|'guide'`。DOM: `#search`（検索入力）、`nav.tabs a[data-tab]`、`section.view[data-view]` ×4、`#status`、`#updated`。
- このタスクでは公開順セクションにカードを横一列（`.strip`）で出すだけにする。Task 8 でタイムラインに置き換える。

- [ ] **Step 1: 失敗するテストを書く**

`tests/js/app.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { tabFromHash, TABS } from '../../assets/app.js';

test('TABS は4つ', () => assert.deepEqual(TABS, ['release', 'story', 'graph', 'guide']));

test('tabFromHash はハッシュからタブ名を取り、不明なら release', () => {
  assert.equal(tabFromHash('#story'), 'story');
  assert.equal(tabFromHash('#graph'), 'graph');
  assert.equal(tabFromHash('#guide'), 'guide');
  assert.equal(tabFromHash(''), 'release');
  assert.equal(tabFromHash('#nope'), 'release');
  assert.equal(tabFromHash(undefined), 'release');
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test`
Expected: `Cannot find module '.../assets/app.js'`

- [ ] **Step 3: index.html を書く**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MCU 作品カタログ</title>
  <meta name="description" content="マーベル・シネマティック・ユニバースの映画とドラマを、公開順・作中の時系列・依存関係図で一覧する。">
  <link rel="stylesheet" href="assets/style.css">
</head>
<body>
  <header class="site-header">
    <h1 class="site-title">MCU 作品カタログ</h1>
    <label class="search">
      <span class="visually-hidden">作品を検索</span>
      <input id="search" type="search" placeholder="タイトルで検索" autocomplete="off">
    </label>
    <nav class="tabs" aria-label="表示の切り替え">
      <a href="#release" data-tab="release">公開順</a>
      <a href="#story" data-tab="story">時系列</a>
      <a href="#graph" data-tab="graph">依存関係図</a>
      <a href="#guide" data-tab="guide">ガイド</a>
    </nav>
  </header>
  <main>
    <p id="status" class="status" hidden></p>
    <section id="view-release" class="view" data-view="release" aria-label="公開順"></section>
    <section id="view-story" class="view" data-view="story" aria-label="作中の時系列" hidden></section>
    <section id="view-graph" class="view" data-view="graph" aria-label="依存関係図" hidden></section>
    <section id="view-guide" class="view" data-view="guide" aria-label="ガイド" hidden></section>
  </main>
  <footer class="site-footer">
    <p>データ更新日: <time id="updated"></time>。作品情報は Wikipedia と各公式発表に基づく。</p>
    <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
  </footer>
  <script type="module" src="assets/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: style.css を書く（基本とカード）**

`assets/style.css`:

```css
:root {
  --bg: #0b0d12;
  --surface: #151923;
  --surface-2: #1d2230;
  --border: #2a3040;
  --text: #e8eaf0;
  --muted: #9aa3b5;
  --accent: #e62429;
  --accent-soft: rgba(230, 36, 41, 0.18);
  --phase-1: hsl(358 78% 30%);
  --phase-2: hsl(358 78% 37%);
  --phase-3: hsl(358 78% 44%);
  --phase-4: hsl(358 78% 51%);
  --phase-5: hsl(358 78% 58%);
  --phase-6: hsl(358 78% 65%);
  --phase-7: hsl(358 78% 74%);
  --card-w: 200px;
}

* { box-sizing: border-box; }
html { color-scheme: dark; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif;
  line-height: 1.5;
}
[hidden] { display: none !important; }
.visually-hidden {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap;
}
a { color: inherit; }
button { font: inherit; }

/* ヘッダー */
.site-header {
  position: sticky; top: 0; z-index: 10;
  display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: center;
  padding: 12px 20px;
  background: rgba(11, 13, 18, 0.92);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(8px);
}
.site-title { margin: 0; font-size: 1.25rem; letter-spacing: 0.04em; }
.search input {
  width: 220px; padding: 6px 10px; border-radius: 6px;
  border: 1px solid var(--border); background: var(--surface); color: var(--text);
}
.tabs { display: flex; gap: 4px; margin-left: auto; }
.tabs a { padding: 6px 12px; border-radius: 6px; text-decoration: none; color: var(--muted); }
.tabs a[aria-current="page"] { background: var(--accent); color: #fff; }

main { padding: 16px 20px 40px; }
.status { padding: 12px; border: 1px solid var(--accent); border-radius: 6px; background: var(--accent-soft); }
.site-footer { padding: 16px 20px; color: var(--muted); font-size: 0.85rem; border-top: 1px solid var(--border); }
.strip { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }

/* カード */
.card {
  flex: 0 0 var(--card-w); width: var(--card-w);
  display: flex; flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-top: 4px solid var(--phase-color, var(--accent));
  border-radius: 8px; overflow: hidden;
}
.card[data-phase="1"] { --phase-color: var(--phase-1); }
.card[data-phase="2"] { --phase-color: var(--phase-2); }
.card[data-phase="3"] { --phase-color: var(--phase-3); }
.card[data-phase="4"] { --phase-color: var(--phase-4); }
.card[data-phase="5"] { --phase-color: var(--phase-5); }
.card[data-phase="6"] { --phase-color: var(--phase-6); }
.card[data-phase="7"] { --phase-color: var(--phase-7); }
.card--upcoming { border-style: dashed; border-top-style: solid; }
.card.is-dim { opacity: 0.35; }
.card__poster { aspect-ratio: 2 / 3; background: var(--surface-2); }
.card__poster img { display: block; width: 100%; height: 100%; object-fit: cover; }
.card__placeholder {
  display: flex; align-items: center; justify-content: center; height: 100%;
  padding: 12px; text-align: center; color: var(--muted); font-size: 0.9rem;
}
.card__body { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px 12px; flex: 1; }
.card__meta { margin: 0; font-size: 0.75rem; color: var(--muted); }
.card__title { margin: 0; font-size: 0.95rem; line-height: 1.3; }
.card__title-en { margin: 0; font-size: 0.75rem; color: var(--muted); }
.card__dates { margin: 0; font-size: 0.78rem; }
.card__summary { margin: 4px 0 0; font-size: 0.8rem; color: var(--muted); }
.card__watched { margin-top: auto; padding-top: 6px; font-size: 0.8rem; color: var(--muted); cursor: pointer; }
.card__watched.is-watched { color: var(--text); }
.card__watched input:disabled + span { opacity: 0.5; }
.card--compact { flex-direction: row; width: auto; flex-basis: auto; }
.card--compact .card__poster { flex: 0 0 60px; aspect-ratio: 2 / 3; }
.card--compact .card__body { padding: 8px 10px; }
```

- [ ] **Step 5: card.js を書く**

`assets/card.js`:

```js
import { displayTitle, dateLabel, posterUrl, KIND_LABELS, phaseLabel } from './data.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function placeholder(work) {
  return el('div', 'card__placeholder', displayTitle(work));
}

function posterBlock(work) {
  const poster = el('div', 'card__poster');
  const url = posterUrl(work);
  if (!url) {
    poster.append(placeholder(work));
    return poster;
  }
  const img = document.createElement('img');
  img.src = url;
  img.alt = displayTitle(work);
  img.loading = 'lazy';
  img.width = 342;
  img.height = 513;
  img.addEventListener('error', () => {
    img.remove();
    poster.append(placeholder(work));
  });
  poster.append(img);
  return poster;
}

function watchedToggle(work, store, onChange) {
  const label = el('label', 'card__watched');
  const input = document.createElement('input');
  input.type = 'checkbox';
  const usable = Boolean(store && store.available);
  input.disabled = !usable;
  input.checked = usable && store.has(work.id);
  label.classList.toggle('is-watched', input.checked);
  input.addEventListener('change', () => {
    const now = store.toggle(work.id);
    label.classList.toggle('is-watched', now);
    if (onChange) onChange(work, now);
  });
  label.append(input, el('span', null, ' 視聴済み'));
  return label;
}

/** 作品カードを返す。compact はガイドの一覧向けの横長表示。 */
export function renderCard(work, { store, onChange, compact = false } = {}) {
  const card = el('article', compact ? 'card card--compact' : 'card');
  card.dataset.id = work.id;
  card.dataset.phase = String(work.phase);
  if (work.upcoming) card.classList.add('card--upcoming');
  if (work.essential) card.classList.add('card--essential');

  const body = el('div', 'card__body');
  const meta = `${KIND_LABELS[work.kind]} · ${phaseLabel(work.phase)}${work.upcoming ? ' · 公開予定' : ''}`;
  body.append(
    el('p', 'card__meta', meta),
    el('h3', 'card__title', displayTitle(work)),
    el('p', 'card__title-en', work.titleEn),
    el('p', 'card__dates', `日本 ${dateLabel(work.dateJp, work.upcoming)} / 米国 ${dateLabel(work.dateUs, work.upcoming)}`),
  );
  if (!compact) body.append(el('p', 'card__summary', work.summary));
  body.append(watchedToggle(work, store, onChange));

  card.append(posterBlock(work), body);
  return card;
}
```

- [ ] **Step 6: app.js を書く（このタスクでは公開順にカードの横一列を出す）**

`assets/app.js`:

```js
import { loadJson, includedWorks } from './data.js';
import { createWatchedStore } from './watched.js';
import { renderCard } from './card.js';

export const TABS = ['release', 'story', 'graph', 'guide'];

/** '#story' → 'story'。未知や空なら 'release'。 */
export function tabFromHash(hash) {
  const name = (hash ?? '').replace(/^#/, '');
  return TABS.includes(name) ? name : 'release';
}

function storageOrNull() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function showStatus(message) {
  const status = document.getElementById('status');
  status.hidden = !message;
  status.textContent = message ?? '';
}

function activateTab(name) {
  for (const section of document.querySelectorAll('.view')) section.hidden = section.dataset.view !== name;
  for (const link of document.querySelectorAll('.tabs a')) {
    link.setAttribute('aria-current', link.dataset.tab === name ? 'page' : 'false');
  }
}

async function init() {
  let data;
  try {
    data = await loadJson('data/mcu-works.json');
  } catch (err) {
    showStatus(`データを読み込めませんでした: ${err.message}`);
    return;
  }
  const works = includedWorks(data);
  const store = createWatchedStore(storageOrNull());
  document.getElementById('updated').textContent = data.meta.generated;
  if (!store.available) showStatus('このブラウザでは視聴済みを保存できません');

  const strip = document.createElement('div');
  strip.className = 'strip';
  strip.append(...works.map((work) => renderCard(work, { store })));
  document.getElementById('view-release').append(strip);

  const applyHash = () => activateTab(tabFromHash(location.hash));
  window.addEventListener('hashchange', applyHash);
  applyHash();
}

if (typeof document !== 'undefined') init();
```

- [ ] **Step 7: テストと手動確認**

Run: `npm test`
Expected: `# pass 16` / `# fail 0`

Run: `npm run serve` を別ターミナルで起動し、ブラウザで `http://localhost:8000/` を開く。確認項目:
- 63枚のカードが横一列に並び、横スクロールできる
- ポスターがない作品はタイトル入りのプレースホルダー（Task 4 Step 6 未実施なら全カード）
- 「視聴済み」を押すと文字が白くなり、再読み込み後も残る
- タブを押すと URL が `#story` などに変わり、押したセクションだけが表示される。`#story` を直接開いても時系列タブが選ばれる
- `data/mcu-works.json` を一時的にリネームして再読み込みすると「データを読み込めませんでした: ... (404)」が出る。確認後に名前を戻す
- DevTools の Application → Local Storage で `mcu-watched` に配列が入っている

- [ ] **Step 8: コミット**

```bash
git add index.html assets/style.css assets/card.js assets/app.js tests/js/app.test.js
git commit -m "feat(ui): ページの骨組み、作品カード、タブ切り替え" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7"
```

---

### Task 8: timeline.js（公開順・時系列の横タイムライン）

**Files:**
- Create: `assets/timeline.js`, `tests/js/timeline.test.js`
- Modify: `assets/app.js`（`.strip` をタイムライン2本に置き換え、検索を配線）
- Modify: `assets/style.css`（タイムラインのスタイルを末尾に追加）

**Interfaces:**
- Consumes: Task 5 の `sortByRelease` / `sortByStory` / `matchesQuery`、Task 7 の `renderCard`
- Produces: 純粋関数 `groupWorks(works, keyFn) -> [{ key, works }]`（連続する同じキーをまとめる）、`releaseKeyFn(work) -> '2021年'|'未定'`、`storyKeyFn(work) -> storyYear|'未発表'`、`cardState(work, { query, essentialOnly }) -> 'hidden'|'dim'|'normal'`。DOM: `createTimeline(container, works, { mode: 'release'|'story', store }) -> { setQuery(query) }`。並べ替え（古い順／新しい順）と主要作ハイライトは各タイムラインが自前の操作部を持つ。

- [ ] **Step 1: 失敗するテストを書く**

`tests/js/timeline.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupWorks, releaseKeyFn, storyKeyFn, cardState } from '../../assets/timeline.js';

const work = (id, dateUs, storyYear, essential = false) => ({
  id, dateUs, storyYear, essential, titleJa: id, titleEn: id, kind: 'film', season: null,
});

test('groupWorks は連続する同じキーをまとめ、順序を保つ', () => {
  const works = [work('a', '2021-01-15'), work('b', '2021-03-19'), work('c', '2022-03-30'), work('d', '2021-11-24')];
  const groups = groupWorks(works, releaseKeyFn);
  assert.deepEqual(groups.map((g) => g.key), ['2021年', '2022年', '2021年']);
  assert.deepEqual(groups[0].works.map((w) => w.id), ['a', 'b']);
});

test('releaseKeyFn / storyKeyFn', () => {
  assert.equal(releaseKeyFn(work('a', '2027-03')), '2027年');
  assert.equal(releaseKeyFn(work('a', null)), '未定');
  assert.equal(storyKeyFn(work('a', null, '1943–1945')), '1943–1945');
  assert.equal(storyKeyFn(work('a', null, '')), '未発表');
});

test('cardState は検索で hidden、主要作ハイライトで dim', () => {
  const essential = work('iron-man', '2008-05-02', '2008', true);
  const other = work('thor', '2011-05-06', '2010', false);
  assert.equal(cardState(other, { query: 'iron' }), 'hidden');
  assert.equal(cardState(essential, { query: 'iron' }), 'normal');
  assert.equal(cardState(other, { essentialOnly: true }), 'dim');
  assert.equal(cardState(essential, { essentialOnly: true }), 'normal');
  assert.equal(cardState(other, {}), 'normal');
  assert.equal(cardState(other, { query: 'thor', essentialOnly: true }), 'dim');
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test`
Expected: `Cannot find module '.../assets/timeline.js'`

- [ ] **Step 3: timeline.js を書く**

`assets/timeline.js`:

```js
import { renderCard } from './card.js';
import { sortByRelease, sortByStory, matchesQuery } from './data.js';

/** 連続する同じキーの作品をまとめる。順序は保つ。 */
export function groupWorks(works, keyFn) {
  const groups = [];
  for (const work of works) {
    const key = keyFn(work);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.works.push(work);
    else groups.push({ key, works: [work] });
  }
  return groups;
}

export const releaseKeyFn = (work) => (work.dateUs ? `${work.dateUs.slice(0, 4)}年` : '未定');
export const storyKeyFn = (work) => work.storyYear || '未発表';

/** 検索と主要作ハイライトからカードの表示状態を決める。 */
export function cardState(work, { query = '', essentialOnly = false } = {}) {
  if (!matchesQuery(work, query)) return 'hidden';
  if (essentialOnly && !work.essential) return 'dim';
  return 'normal';
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 横スクロールのタイムラインを container に描く。mode は 'release' か 'story'。 */
export function createTimeline(container, works, { mode, store }) {
  const state = { query: '', dir: 'asc', essentialOnly: false };
  const cards = new Map();
  container.classList.add('timeline');

  const controls = el('div', 'timeline__controls');
  const sortButton = el('button', 'timeline__sort');
  sortButton.type = 'button';
  sortButton.title = '押すと並び順を反転します';
  const essentialLabel = el('label', 'timeline__essential');
  const essentialInput = document.createElement('input');
  essentialInput.type = 'checkbox';
  essentialLabel.append(essentialInput, el('span', null, ' 主要作をハイライト'));
  const count = el('span', 'timeline__count');
  controls.append(sortButton, essentialLabel, count);

  const track = el('div', 'timeline__track');
  container.append(controls, track);

  function applyStates() {
    let visible = 0;
    for (const { work, card } of cards.values()) {
      const stateName = cardState(work, state);
      card.hidden = stateName === 'hidden';
      card.classList.toggle('is-dim', stateName === 'dim');
      if (stateName !== 'hidden') visible += 1;
    }
    for (const group of track.querySelectorAll('.timeline__group')) {
      group.hidden = !group.querySelector('.card:not([hidden])');
    }
    count.textContent = `${visible} / ${works.length} 件`;
  }

  function renderTrack() {
    const sorted = mode === 'release' ? sortByRelease(works, state.dir) : sortByStory(works, state.dir);
    const groups = groupWorks(sorted, mode === 'release' ? releaseKeyFn : storyKeyFn);
    cards.clear();
    track.replaceChildren(...groups.map((group) => {
      const section = el('section', 'timeline__group');
      const row = el('div', 'timeline__row');
      for (const work of group.works) {
        const card = renderCard(work, { store });
        cards.set(work.id, { work, card });
        row.append(card);
      }
      section.append(el('h2', 'timeline__heading', group.key), row);
      return section;
    }));
    applyStates();
  }

  function updateSortLabel() {
    sortButton.textContent = state.dir === 'asc' ? '並び: 古い順' : '並び: 新しい順';
  }

  sortButton.addEventListener('click', () => {
    state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    updateSortLabel();
    renderTrack();
  });
  essentialInput.addEventListener('change', () => {
    state.essentialOnly = essentialInput.checked;
    applyStates();
  });

  updateSortLabel();
  renderTrack();

  return {
    setQuery(query) {
      state.query = query ?? '';
      applyStates();
    },
  };
}
```

- [ ] **Step 4: app.js の `.strip` をタイムラインに置き換える**

`assets/app.js` の import に追加:

```js
import { createTimeline } from './timeline.js';
```

`renderCard` の import 行は削除する（使わなくなる）。`init()` 内の `const strip = ...` から `document.getElementById('view-release').append(strip);` までの4行を次に置き換える:

```js
  const release = createTimeline(document.getElementById('view-release'), works, { mode: 'release', store });
  const story = createTimeline(document.getElementById('view-story'), works, { mode: 'story', store });
  const search = document.getElementById('search');
  search.addEventListener('input', () => {
    release.setQuery(search.value);
    story.setQuery(search.value);
  });
```

- [ ] **Step 5: style.css にタイムラインのスタイルを追加**

`assets/style.css` の末尾に追加:

```css
/* タイムライン */
.timeline__controls { display: flex; gap: 16px; align-items: center; margin-bottom: 12px; font-size: 0.9rem; }
.timeline__sort {
  padding: 6px 12px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--border); background: var(--surface); color: var(--text);
}
.timeline__essential { cursor: pointer; }
.timeline__count { color: var(--muted); }
.timeline__track { display: flex; gap: 24px; overflow-x: auto; padding-bottom: 12px; }
.timeline__group { flex: 0 0 auto; }
.timeline__heading {
  position: sticky; left: 0; margin: 0 0 8px; padding: 2px 6px;
  font-size: 1rem; color: var(--muted); background: var(--bg); width: max-content;
}
.timeline__row { display: flex; gap: 12px; }
```

- [ ] **Step 6: テストと手動確認**

Run: `npm test`
Expected: `# pass 19` / `# fail 0`

ブラウザで `http://localhost:8000/` を開いて確認:
- 公開順タブ: 「2008年」「2010年」… の見出しごとにカードが並び、横スクロールできる。見出しは各年のブロック内で左に固定される
- 「並び: 古い順」を押すと「並び: 新しい順」になり、2028年が左端に来る
- 「主要作をハイライト」を入れると主要作以外が薄くなる（消えない）
- 検索に「ロキ」と入れると、ロキ2本だけが残り、他の年ブロックが消える。件数が「2 / 63 件」になる
- 時系列タブ: 見出しが「1943–1945」「1995」「2008」… の順で、『キャプテン・アメリカ/ザ・ファースト・アベンジャー』が先頭。検索・並べ替え・ハイライトが同じように動く
- 視聴済みのチェックは両タブで同じ作品に反映される（一方で押した後、他方を並べ替えると反映される）

- [ ] **Step 7: コミット**

```bash
git add assets/timeline.js assets/app.js assets/style.css tests/js/timeline.test.js
git commit -m "feat(ui): 公開順と時系列の横タイムライン、検索・並べ替え・主要作ハイライト" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7"
```

---

### Task 9: graph-layout.js（依存関係図の配置計算と祖先探索）

**Files:**
- Create: `assets/graph-layout.js`, `tests/js/graph-layout.test.js`

**Interfaces:**
- Consumes: Task 5 の `sortByRelease`
- Produces（純粋関数）:
  - `LANES: [{ id, label }]` 12本（順序が縦位置になる）、`NODE_W = 72`、`NODE_H = 108`
  - `layoutGraph(works, edges, { colWidth = 110, rowHeight = 150, marginX = 170, marginY = 40 }) -> { nodes: [{ id, work, x, y }], edges: [{ ...edge, x1, y1, x2, y2 }], lanes: [{ id, label, y }], width, height, rowHeight }`。x は公開順の列、y はレーン。未知のレーンは「その他」
  - `ancestorsOf(id, edges) -> Set<string>`（推移的な前提作品。自分を含まない）
  - `edgePath(x1, y1, x2, y2) -> string`（SVG の 3次ベジェ）

- [ ] **Step 1: 失敗するテストを書く**

`tests/js/graph-layout.test.js`:

```js
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
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test`
Expected: `Cannot find module '.../assets/graph-layout.js'`

- [ ] **Step 3: graph-layout.js を書く**

`assets/graph-layout.js`:

```js
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
  const nodes = ordered.map((work, i) => ({
    id: work.id,
    work,
    x: marginX + i * colWidth,
    y: marginY + (laneIndex.get(work.lane) ?? otherIndex) * rowHeight,
  }));
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: `# pass 23` / `# fail 0`

- [ ] **Step 5: コミット**

```bash
git add assets/graph-layout.js tests/js/graph-layout.test.js
git commit -m "feat(assets): 依存関係図の配置計算と祖先探索" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7"
```

---

### Task 10: graph.js（依存関係図の SVG 描画・パン・ズーム・強調）

**Files:**
- Create: `assets/graph.js`, `tests/js/graph.test.js`
- Modify: `assets/app.js`（`dependencies.json` を読み、依存図を配線）
- Modify: `assets/style.css`（図のスタイルを末尾に追加）

**Interfaces:**
- Consumes: Task 9 の `layoutGraph` / `ancestorsOf` / `edgePath` / `NODE_W` / `NODE_H`、Task 5 の `displayTitle` / `posterUrl` / `matchesQuery`
- Produces: 純粋関数 `shortLabel(work, max = 10) -> string`。DOM: `createGraph(container, works, edges) -> { highlight(id | null), setQuery(query), focused }`。ノードを押すと前提作品（祖先）と、その間の辺が強調され、他は薄くなる。背景を押すか Esc で解除。ホイールとボタンで拡大縮小、ドラッグで移動。

- [ ] **Step 1: 失敗するテストを書く**

`tests/js/graph.test.js`:

```js
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
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test`
Expected: `Cannot find module '.../assets/graph.js'`

- [ ] **Step 3: graph.js を書く**

`assets/graph.js`:

```js
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
```

- [ ] **Step 4: app.js に依存図を配線する**

`assets/app.js` の import に追加:

```js
import { createGraph } from './graph.js';
```

`init()` の読み込み部分を、2ファイルを同時に読む形に差し替える:

```js
  let data;
  let deps;
  try {
    [data, deps] = await Promise.all([loadJson('data/mcu-works.json'), loadJson('data/dependencies.json')]);
  } catch (err) {
    showStatus(`データを読み込めませんでした: ${err.message}`);
    return;
  }
```

`const story = createTimeline(...)` の直後に追加し、検索のリスナーにも1行足す:

```js
  const graph = createGraph(document.getElementById('view-graph'), works, deps.edges);
```

```js
    graph.setQuery(search.value);
```

- [ ] **Step 5: style.css に図のスタイルを追加**

`assets/style.css` の末尾に追加:

```css
/* 依存関係図 */
.graph__toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
.graph__toolbar button {
  padding: 6px 12px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--border); background: var(--surface); color: var(--text);
}
.graph__info { margin: 0 0 0 8px; font-size: 0.85rem; color: var(--muted); }
.graph__svg {
  display: block; width: 100%; aspect-ratio: 5 / 3;
  background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  touch-action: none; cursor: grab; user-select: none;
}
.graph__svg:active { cursor: grabbing; }
.graph__lane { fill: transparent; }
.graph__lane--alt { fill: rgba(255, 255, 255, 0.03); }
.graph__lane-label { fill: var(--muted); font-size: 14px; }
.graph__edge { fill: none; stroke: #5b6478; stroke-width: 1.5; opacity: 0.7; transition: opacity 0.15s; }
.graph__arrow { fill: #5b6478; }
.graph__edge.is-ancestor { stroke: var(--accent); stroke-width: 2.5; opacity: 1; }
.graph__edge.is-muted { opacity: 0.08; }
.graph__node { cursor: pointer; transition: opacity 0.15s; }
.graph__node:focus { outline: none; }
.graph__node-box { fill: var(--surface-2); }
.graph__node-frame { fill: none; stroke: var(--border); stroke-width: 1.5; }
.graph__node-initial { fill: var(--muted); font-size: 18px; dominant-baseline: middle; }
.graph__node.is-focus .graph__node-frame, .graph__node:focus .graph__node-frame { stroke: #fff; stroke-width: 3; }
.graph__node.is-ancestor .graph__node-frame { stroke: var(--accent); stroke-width: 3; }
.graph__node.is-match .graph__node-frame { stroke: #ffd166; stroke-width: 3; }
.graph__node.is-muted { opacity: 0.2; }
.graph__label { fill: var(--text); font-size: 12px; }
```

- [ ] **Step 6: テストと手動確認**

Run: `npm test`
Expected: `# pass 24` / `# fail 0`

ブラウザで `http://localhost:8000/#graph` を開いて確認:
- 12本のレーン名が左に並び、63個のノード（ポスター、なければ頭2文字）が左から公開順に並ぶ
- 辺が左から右へ曲線で伸び、先端に矢印がある。辺にマウスを載せると理由（note）がツールチップに出る
- ドラッグで図が動き、ホイールと「＋」「－」で拡大縮小し、「リセット」で戻る
- 『アベンジャーズ/ドゥームズデイ』を押すと、前提作品が赤枠になり、関係ない作品と辺が薄くなる。案内文に「先に観る作品 N 本」と出る
- 背景を押すか Esc で強調が消える。ドラッグ後に指を離しても強調が変わらない
- 検索に「ソー」と入れると該当ノードが黄枠になる。空にすると消える
- タブを切り替えても図の位置が保たれる

- [ ] **Step 7: コミット**

```bash
git add assets/graph.js assets/app.js assets/style.css tests/js/graph.test.js
git commit -m "feat(ui): 依存関係図（SVG、パン・ズーム、前提作品の強調）" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7"
```

---

### Task 11: archify で予習マップを生成

**Files:**
- Create: `scripts/build_diagrams.py`, `tests/py/test_build_diagrams.py`, `diagrams/src/visionquest.architecture.json`, `diagrams/src/avengers-doomsday.architecture.json`, `diagrams/visionquest.html`, `diagrams/avengers-doomsday.html`

**Interfaces:**
- Consumes: Task 3 の `data/guides.json`（`prep[].target` / `items[].id`）、`data/mcu-works.json`
- Produces: `build_diagrams.short_label(rec) -> str`、`build_diagrams.build(guide, by_id) -> dict`（archify の architecture IR）、CLI `python3 scripts/build_diagrams.py` が `diagrams/src/<target>.architecture.json` を書く。archify が `diagrams/<target>.html`（自己完結の HTML）を作る。Task 12 のガイドがこの HTML を iframe で読む。

- [ ] **Step 1: archify を入れて動作確認**

```bash
npx skills add tt-a1i/archify -g
node ~/.claude/skills/archify/bin/archify.mjs doctor
```

Expected: `[ok]` が並び `Archify is ready.`。`~/.claude/skills/archify/bin/archify.mjs` が無い場合は、次で代替する（`tools/` は .gitignore 済み）:

```bash
git clone --depth 1 https://github.com/tt-a1i/archify tools/archify-src
node tools/archify-src/archify/bin/archify.mjs doctor
```

以降の `ARCHIFY` は動いた方のパスにする: `ARCHIFY=~/.claude/skills/archify/bin/archify.mjs` または `ARCHIFY=tools/archify-src/archify/bin/archify.mjs`。

- [ ] **Step 2: 失敗するテストを書く**

`tests/py/test_build_diagrams.py`:

```python
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import build_diagrams  # noqa: E402

FILM = {'id': 'thunderbolts', 'title_ja': 'サンダーボルツ*', 'title_en': 'Thunderbolts*', 'release_us': '2025-05-02', 'status': 'released'}
LONG = {'id': 'doctor-strange-multiverse-of-madness', 'title_ja': 'ドクター・ストレンジ/マルチバース・オブ・マッドネス',
        'title_en': 'Doctor Strange in the Multiverse of Madness', 'release_us': '2022-05-06', 'status': 'released'}
SERIES = {'id': 'loki-s2', 'type': 'series', 'season': 2, 'title_ja': 'ロキ', 'title_en': 'Loki', 'premiere_us': '2023-10-05', 'status': 'released'}
TARGET = {'id': 'avengers-doomsday', 'title_ja': 'アベンジャーズ/ドゥームズデイ', 'title_en': 'Avengers: Doomsday',
          'release_us': '2026-12-18', 'status': 'upcoming'}


class ShortLabelTest(unittest.TestCase):
    def test_uses_short_map_for_long_titles(self):
        self.assertEqual(build_diagrams.short_label(LONG), 'ストレンジ／マルチバース')

    def test_adds_season_for_series(self):
        self.assertEqual(build_diagrams.short_label(SERIES), 'ロキ シーズン2')

    def test_keeps_short_title(self):
        self.assertEqual(build_diagrams.short_label(FILM), 'サンダーボルツ*')

    def test_season1_has_no_number(self):
        wanda = {'id': 'wandavision', 'type': 'series', 'season': 1, 'title_ja': 'ワンダヴィジョン', 'title_en': 'WandaVision', 'premiere_us': '2021-01-15', 'status': 'released'}
        self.assertEqual(build_diagrams.short_label(wanda), 'ワンダヴィジョン')


class BuildTest(unittest.TestCase):
    def test_build_places_items_in_a_row_and_target_below(self):
        by_id = {r['id']: r for r in (FILM, LONG, SERIES, TARGET)}
        guide = {'target': 'avengers-doomsday', 'items': [{'id': 'thunderbolts', 'note': 'a'}, {'id': 'loki-s2', 'note': 'b'}, {'id': LONG['id'], 'note': 'c'}]}
        doc = build_diagrams.build(guide, by_id)
        self.assertEqual(doc['diagram_type'], 'architecture')
        self.assertEqual(doc['meta']['quality_profile'], 'standard')
        comps = doc['components']
        self.assertEqual([c['id'] for c in comps], ['thunderbolts', 'loki_s2', 'doctor_strange_multiverse_of_madness', 'avengers_doomsday'])
        self.assertEqual([c['pos'][1] for c in comps[:-1]], [40, 40, 40])
        self.assertEqual(comps[0]['pos'][0], 30)
        self.assertEqual(comps[1]['pos'][0], 30 + 230)
        self.assertEqual(comps[-1]['pos'][1], 300)
        self.assertEqual(comps[-1]['tag'], '公開予定')
        self.assertEqual(comps[0]['type'], 'backend')
        self.assertEqual(comps[1]['type'], 'frontend')
        self.assertEqual(comps[1]['sublabel'], '2023-10 ドラマ')
        self.assertEqual(len(doc['connections']), 3)
        self.assertTrue(all(c['fromSide'] == 'bottom' and c['toSide'] == 'top' and c['to'] == 'avengers_doomsday' for c in doc['connections']))

    def test_released_target_has_no_tag(self):
        by_id = {r['id']: r for r in (FILM, LONG)}
        guide = {'target': 'thunderbolts', 'items': [{'id': LONG['id'], 'note': 'c'}]}
        self.assertNotIn('tag', build_diagrams.build(guide, by_id)['components'][-1])


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 3: 失敗を確認**

Run: `npm run test:py`
Expected: `ModuleNotFoundError: No module named 'build_diagrams'`

- [ ] **Step 4: build_diagrams.py を書く**

`scripts/build_diagrams.py`:

```python
#!/usr/bin/env python3
"""guides.json の予習リストから archify 用の入力 JSON を生成する。

出力: diagrams/src/<target>.architecture.json
その後 archify の deliver で diagrams/<target>.html を作る（README 参照）。
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKS_PATH = ROOT / 'data' / 'mcu-works.json'
GUIDES_PATH = ROOT / 'data' / 'guides.json'
OUT_DIR = ROOT / 'diagrams' / 'src'

# ノード幅 200px に収まる略称。無い作品は title_ja をそのまま使う（シーズン2以降は番号を付ける）。
SHORT = {
    'avengers-age-of-ultron': 'エイジ・オブ・ウルトロン',
    'captain-america-civil-war': 'シビル・ウォー',
    'avengers-infinity-war': 'インフィニティ・ウォー',
    'doctor-strange-multiverse-of-madness': 'ストレンジ／マルチバース',
    'thor-love-and-thunder': 'ソー:ラブ&サンダー',
    'black-panther-wakanda-forever': 'ワカンダ・フォーエバー',
    'deadpool-and-wolverine': 'デッドプール&ウルヴァリン',
    'captain-america-brave-new-world': 'ブレイブ・ニュー・ワールド',
    'the-fantastic-four-first-steps': 'ファンタスティック4',
    'spider-man-brand-new-day': 'ブランド・ニュー・デイ',
    'avengers-doomsday': 'アベンジャーズ/ドゥームズデイ',
}
TYPE = {'film': 'backend', 'series': 'frontend', 'special': 'external'}
KIND_JA = {'film': '映画', 'series': 'ドラマ', 'special': 'スペシャル'}
W, H, GAP = 200, 52, 30


def kind_of(rec):
    return 'film' if 'release_us' in rec else rec['type']


def date_of(rec):
    return rec.get('release_us') or rec.get('premiere_us') or ''


def short_label(rec):
    if rec['id'] in SHORT:
        return SHORT[rec['id']]
    title = rec['title_ja']
    if kind_of(rec) == 'series' and (rec.get('season') or 1) > 1:
        title += f" シーズン{rec['season']}"
    return title


def component(rec, pos, size, tag=None):
    kind = kind_of(rec)
    comp = {
        'id': rec['id'].replace('-', '_'),
        'type': TYPE[kind],
        'label': short_label(rec),
        'sublabel': f"{date_of(rec)[:7]} {KIND_JA[kind]}",
        'pos': pos,
        'size': size,
    }
    if tag:
        comp['tag'] = tag
    return comp


def build(guide, by_id):
    target = by_id[guide['target']]
    items = [by_id[item['id']] for item in guide['items']]
    comps = [component(rec, [30 + k * (W + GAP), 40], [W, H]) for k, rec in enumerate(items)]
    target_x = 30 + ((len(items) - 1) / 2) * (W + GAP) - 20
    comps.append(component(target, [target_x, 300], [W + 40, H + 8], tag='公開予定' if target['status'] != 'released' else None))
    conns = [{'id': f"e{k}", 'from': c['id'], 'to': comps[-1]['id'], 'fromSide': 'bottom', 'toSide': 'top'} for k, c in enumerate(comps[:-1])]
    return {
        'schema_version': 1,
        'diagram_type': 'architecture',
        'meta': {
            'title': f"『{target['title_ja']}』予習マップ",
            'quality_profile': 'standard',
            'legend': {'mode': 'auto', 'entries': {'backend': {'label': '映画'}, 'frontend': {'label': 'ドラマ'}, 'external': {'label': 'スペシャル'}}},
        },
        'components': comps,
        'connections': conns,
        'cards': [{'dot': 'cyan', 'title': '見方', 'items': ['矢印の元の作品を先に観る', '上の段は公開順に左から並ぶ', '「公開予定」は未公開の作品']}],
    }


def main():
    data = json.loads(WORKS_PATH.read_text(encoding='utf-8'))
    guides = json.loads(GUIDES_PATH.read_text(encoding='utf-8'))
    by_id = {rec['id']: rec for rec in data['films'] + data['series']}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for guide in guides['prep']:
        out = OUT_DIR / f"{guide['target']}.architecture.json"
        out.write_text(json.dumps(build(guide, by_id), ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(out.relative_to(ROOT))


if __name__ == '__main__':
    main()
```

- [ ] **Step 5: テストが通ることを確認し、入力を生成**

Run: `npm run test:py && python3 scripts/build_diagrams.py`
Expected: `Ran 39 tests ... OK`、`diagrams/src/visionquest.architecture.json` と `diagrams/src/avengers-doomsday.architecture.json`

- [ ] **Step 6: 検証と生成**

```bash
ARCHIFY=~/.claude/skills/archify/bin/archify.mjs
for t in visionquest avengers-doomsday; do
  node $ARCHIFY validate architecture diagrams/src/$t.architecture.json --quality standard --json | python3 -c "import sys,json; d=json.load(sys.stdin); print('$t', 'ok' if d['ok'] else 'NG'); [print(' -', x.get('message','')[:200]) for x in d.get('diagnostics', [])]"
done
```

Expected: 両方 `ok`。NG の場合は診断メッセージに従って `scripts/build_diagrams.py` を直す。よくある2種類:
- `Label "..." (~NNNpx) is wider than component` → `SHORT` にその作品の短い略称を足す
- `endpoint-side-direction` → `fromSide`/`toSide` が `bottom`/`top` になっているか確認する

通ったら生成する:

```bash
for t in visionquest avengers-doomsday; do
  node $ARCHIFY deliver architecture diagrams/src/$t.architecture.json diagrams/$t.html --quality standard --json | python3 -c "import sys,json; d=json.load(sys.stdin); print('$t deliver', 'ok' if d['ok'] else 'NG: ' + str(d.get('error',''))[:300])"
done
ls -la diagrams/*.html
```

Expected: 両方 `deliver ok`、HTML が 2 ファイル（各 600KB 前後）。

- [ ] **Step 7: ブラウザで確認**

`http://localhost:8000/diagrams/avengers-doomsday.html` を開く:
- 上段に9作品、下段に『アベンジャーズ/ドゥームズデイ』（「公開予定」タグつき）。矢印が上段から下段へ集まる
- 右上の「Dark」で配色が切り替わる。凡例が「映画」「ドラマ」になっている
- `visionquest.html` も同様に5作品＋1作品

- [ ] **Step 8: コミット**

```bash
git add scripts/build_diagrams.py tests/py/test_build_diagrams.py diagrams/src diagrams/visionquest.html diagrams/avengers-doomsday.html
git commit -m "feat(diagrams): archify で予習マップを生成" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7"
```

---

### Task 12: guide.js（短縮ルート・予習リスト・予習マップ）

**Files:**
- Create: `assets/guide.js`, `tests/js/guide.test.js`
- Modify: `assets/app.js`（`guides.json` を読み、ガイドを配線）
- Modify: `assets/style.css`（ガイドのスタイルを末尾に追加）

**Interfaces:**
- Consumes: Task 3 の `data/guides.json`、Task 7 の `renderCard`（`compact: true`）、Task 5 の `displayTitle` / `formatDate` / `sortByRelease`、Task 11 の `diagrams/<target>.html`
- Produces: 純粋関数 `prepEntries(guide, byId) -> [{ work, note }]`（未収録 id は捨てる）。DOM: `renderGuide(container, works, guides, { store })`。

- [ ] **Step 1: 失敗するテストを書く**

`tests/js/guide.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepEntries } from '../../assets/guide.js';

test('prepEntries は id を作品に解決し、未収録は捨てる', () => {
  const byId = new Map([['a', { id: 'a' }], ['b', { id: 'b' }]]);
  const guide = { target: 'z', items: [{ id: 'a', note: 'x' }, { id: 'nope', note: 'y' }, { id: 'b', note: 'z' }] };
  const entries = prepEntries(guide, byId);
  assert.deepEqual(entries.map((e) => e.work.id), ['a', 'b']);
  assert.deepEqual(entries.map((e) => e.note), ['x', 'z']);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test`
Expected: `Cannot find module '.../assets/guide.js'`

- [ ] **Step 3: guide.js を書く**

`assets/guide.js`:

```js
import { renderCard } from './card.js';
import { displayTitle, formatDate, sortByRelease } from './data.js';

/** 予習リストの id を作品に解決する。未収録の id は捨てる。 */
export function prepEntries(guide, byId) {
  return guide.items
    .map((item) => ({ work: byId.get(item.id), note: item.note }))
    .filter((entry) => entry.work);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(title, lead, ...children) {
  const sec = el('section', 'guide__section');
  sec.append(el('h2', 'guide__title', title), el('p', 'guide__lead', lead), ...children);
  return sec;
}

function orderedList(entries, store) {
  const ol = el('ol', 'guide__list');
  for (const { work, note } of entries) {
    const li = el('li', 'guide__item');
    li.append(renderCard(work, { store, compact: true }));
    if (note) li.append(el('p', 'guide__note', note));
    ol.append(li);
  }
  return ol;
}

export function renderGuide(container, works, guides, { store }) {
  const byId = new Map(works.map((w) => [w.id, w]));
  container.classList.add('guide');

  const essential = sortByRelease(works.filter((w) => w.essential)).map((work) => ({ work }));
  const sections = [
    section('短縮ルート', `大作につながる主要作 ${essential.length} 本を公開順に並べたルートです。`, orderedList(essential, store)),
  ];

  for (const guide of guides.prep) {
    const target = byId.get(guide.target);
    if (!target) continue;
    const frame = document.createElement('iframe');
    frame.className = 'guide__map';
    frame.src = `diagrams/${guide.target}.html`;
    frame.title = `${displayTitle(target)} 予習マップ`;
    frame.loading = 'lazy';
    sections.push(section(
      `『${displayTitle(target)}』の予習`,
      `${formatDate(target.dateUs) ?? '公開日未定'} 公開。先に観ておく作品と理由です。`,
      orderedList(prepEntries(guide, byId), store),
      el('h3', 'guide__subtitle', '予習マップ'),
      frame,
    ));
  }
  container.replaceChildren(...sections);
}
```

- [ ] **Step 4: app.js にガイドを配線する**

`assets/app.js` の import に追加:

```js
import { renderGuide } from './guide.js';
```

読み込み部分を3ファイル同時に差し替える:

```js
  let data;
  let deps;
  let guides;
  try {
    [data, deps, guides] = await Promise.all([
      loadJson('data/mcu-works.json'),
      loadJson('data/dependencies.json'),
      loadJson('data/guides.json'),
    ]);
  } catch (err) {
    showStatus(`データを読み込めませんでした: ${err.message}`);
    return;
  }
```

`const graph = createGraph(...)` の直後に追加:

```js
  renderGuide(document.getElementById('view-guide'), works, guides, { store });
```

- [ ] **Step 5: style.css にガイドのスタイルを追加**

`assets/style.css` の末尾に追加:

```css
/* ガイド */
.guide__section { margin-bottom: 36px; }
.guide__title { margin: 0 0 4px; font-size: 1.2rem; }
.guide__subtitle { margin: 16px 0 8px; font-size: 1rem; color: var(--muted); }
.guide__lead { margin: 0 0 12px; color: var(--muted); }
.guide__list { display: grid; gap: 10px; margin: 0; padding-left: 1.6em; max-width: 720px; }
.guide__item { padding-left: 4px; }
.guide__note { margin: 4px 0 0; font-size: 0.85rem; color: var(--muted); }
.guide__map { width: 100%; height: 560px; border: 1px solid var(--border); border-radius: 8px; background: #000; }
```

- [ ] **Step 6: テストと手動確認**

Run: `npm test`
Expected: `# pass 25` / `# fail 0`

ブラウザで `http://localhost:8000/#guide` を開いて確認:
- 「短縮ルート」に主要作24本が番号つきで公開順に並ぶ。横長のカードに視聴済みチェックがある
- 「『ヴィジョンクエスト』の予習」に5本と理由、その下に予習マップ（iframe）が表示される
- 「『アベンジャーズ/ドゥームズデイ』の予習」に9本と理由、予習マップが表示される
- 視聴済みを押すと、公開順タブの同じ作品にも反映される（タブを切り替えて確認）

- [ ] **Step 7: コミット**

```bash
git add assets/guide.js assets/app.js assets/style.css tests/js/guide.test.js
git commit -m "feat(ui): ガイドタブ（短縮ルート・予習リスト・予習マップ）" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7"
```

---

### Task 13: 仕上げ（app.js の最終形、スマホ対応、README、全体確認）

**Files:**
- Modify: `assets/app.js`（最終形に揃える）, `assets/style.css`（スマホ用メディアクエリ）
- Create: `README.md`

**Interfaces:**
- Consumes: Task 5〜12 のすべて
- Produces: 完成した `assets/app.js`（下記が最終形。Task 8/10/12 の差し替えを反映した結果と一致すること）

- [ ] **Step 1: app.js を最終形と突き合わせる**

`assets/app.js` の完成形。差分があればこの内容に揃える:

```js
import { loadJson, includedWorks } from './data.js';
import { createWatchedStore } from './watched.js';
import { createTimeline } from './timeline.js';
import { createGraph } from './graph.js';
import { renderGuide } from './guide.js';

export const TABS = ['release', 'story', 'graph', 'guide'];

/** '#story' → 'story'。未知や空なら 'release'。 */
export function tabFromHash(hash) {
  const name = (hash ?? '').replace(/^#/, '');
  return TABS.includes(name) ? name : 'release';
}

function storageOrNull() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function showStatus(message) {
  const status = document.getElementById('status');
  status.hidden = !message;
  status.textContent = message ?? '';
}

function activateTab(name) {
  for (const section of document.querySelectorAll('.view')) section.hidden = section.dataset.view !== name;
  for (const link of document.querySelectorAll('.tabs a')) {
    link.setAttribute('aria-current', link.dataset.tab === name ? 'page' : 'false');
  }
}

async function init() {
  let data;
  let deps;
  let guides;
  try {
    [data, deps, guides] = await Promise.all([
      loadJson('data/mcu-works.json'),
      loadJson('data/dependencies.json'),
      loadJson('data/guides.json'),
    ]);
  } catch (err) {
    showStatus(`データを読み込めませんでした: ${err.message}`);
    return;
  }
  const works = includedWorks(data);
  const store = createWatchedStore(storageOrNull());
  document.getElementById('updated').textContent = data.meta.generated;
  if (!store.available) showStatus('このブラウザでは視聴済みを保存できません');

  const release = createTimeline(document.getElementById('view-release'), works, { mode: 'release', store });
  const story = createTimeline(document.getElementById('view-story'), works, { mode: 'story', store });
  const graph = createGraph(document.getElementById('view-graph'), works, deps.edges);
  renderGuide(document.getElementById('view-guide'), works, guides, { store });

  const search = document.getElementById('search');
  search.addEventListener('input', () => {
    release.setQuery(search.value);
    story.setQuery(search.value);
    graph.setQuery(search.value);
  });

  const applyHash = () => activateTab(tabFromHash(location.hash));
  window.addEventListener('hashchange', applyHash);
  applyHash();
}

if (typeof document !== 'undefined') init();
```

- [ ] **Step 2: スマホ用のスタイルを追加**

`assets/style.css` の末尾に追加:

```css
/* スマホ */
@media (max-width: 600px) {
  :root { --card-w: 150px; }
  .site-header { padding: 10px 12px; gap: 8px 12px; }
  .search { flex: 1 1 100%; }
  .search input { width: 100%; }
  .tabs { margin-left: 0; width: 100%; justify-content: space-between; }
  .tabs a { padding: 6px 8px; font-size: 0.9rem; }
  main { padding: 12px 12px 32px; }
  .card__summary { display: none; }
  .timeline__controls { flex-wrap: wrap; gap: 8px 12px; }
  .graph__svg { aspect-ratio: 4 / 3; }
  .guide__map { height: 360px; }
}
```

- [ ] **Step 3: README を書く**

`README.md`:

```markdown
# MCU 作品カタログ

マーベル・シネマティック・ユニバースの実写映画とドラマを、公開順・作中の時系列・依存関係図・ガイドの4つの見方で一覧する静的サイト。

## ローカルで見る

```bash
python3 -m http.server 8000
```

`http://localhost:8000/` を開く。ビルドは不要。

## テストと検査

```bash
npm test          # JavaScript（node --test）
npm run test:py   # Python（unittest）
npm run check     # data/ の整合性検査
```

## データを更新する

1. `data/mcu-works.json` を編集する。収録対象には `timeline_order`（1..N の連番）、`story_year`、`lane`、`essential` が必要。
2. 依存関係は `data/dependencies.json`、予習リストは `data/guides.json`。
3. `npm run check` が `OK` になるまで直す。
4. ポスターは `TMDB_API_KEY=... python3 scripts/fetch_posters.py` で取得する。キーは https://www.themoviedb.org/settings/api で発行する。
5. 予習マップは `python3 scripts/build_diagrams.py` で入力を作り、archify で HTML を生成する。

```bash
ARCHIFY=~/.claude/skills/archify/bin/archify.mjs   # npx skills add tt-a1i/archify -g で導入
for t in visionquest avengers-doomsday; do
  node $ARCHIFY deliver architecture diagrams/src/$t.architecture.json diagrams/$t.html --quality standard
done
```

## 構成

- `index.html` / `assets/` … ページ本体（ES モジュール、フレームワークなし）
- `data/` … 作品・依存関係・ガイドの JSON
- `diagrams/` … archify で生成した予習マップ
- `scripts/` … データ検査・ポスター取得・図の入力生成（Python 標準ライブラリのみ）
- `docs/superpowers/` … 設計書と実装計画

## クレジット

This product uses the TMDB API but is not endorsed or certified by TMDB.
作品情報は Wikipedia と各公式発表に基づく。依存関係図は archify（MIT）で生成した図を含む。
```

- [ ] **Step 4: 全体確認**

```bash
npm test && npm run test:py && npm run check
```

Expected: JS `# fail 0`、Python `OK`、`OK: 収録 63 件、依存 104 本`

ブラウザ（DevTools のデバイス切り替えで幅 375px にする）で確認:
- ヘッダーが2段になり、検索が全幅、タブが横一列に収まる
- 公開順・時系列で横スクロールでき、カードが小さくなり、あらすじが消えている
- 依存関係図が指のドラッグで動く（DevTools のタッチモード）
- ガイドの予習マップが 360px の高さで表示される
- 幅 1440px に戻し、4タブすべてで崩れがない
- DevTools の Console にエラーが出ていない

- [ ] **Step 5: コミット**

```bash
git add assets/app.js assets/style.css README.md
git commit -m "feat(ui): スマホ対応と README" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7"
```

---

### Task 14: 公開（GitHub Pages）

**Files:**
- なし（リポジトリ作成と設定のみ）

**Interfaces:**
- Consumes: Task 1〜13 のコミット済み `main` ブランチ
- Produces: `https://<owner>.github.io/<repo>/` で公開されたサイト。リポジトリ名はユーザーが決める（未決なら聞く）。

- [ ] **Step 1: 前提の確認**

```bash
gh auth status
git status --short
```

Expected: `Logged in to github.com`、作業ツリーがクリーン。`gh` が無い場合は `brew install gh && gh auth login` を案内する。

- [ ] **Step 2: リポジトリを作って push**

`REPO` はユーザーが決めた名前に置き換える:

```bash
REPO=mcu-catalog
gh repo create "$REPO" --public --source=. --remote=origin --push
```

Expected: `https://github.com/<owner>/<repo>` が表示され、`main` が push される。

- [ ] **Step 3: GitHub Pages を有効にする**

```bash
gh api -X POST "repos/{owner}/$REPO/pages" -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/'
gh api "repos/{owner}/$REPO/pages" --jq '.html_url, .status'
```

Expected: `html_url` が `https://<owner>.github.io/<repo>/`。`status` は `building` → 数分後に `built`。API が 422 を返す場合は、ブラウザで Settings → Pages → Source を「Deploy from a branch」、Branch を `main` / `/ (root)` にして保存する。

- [ ] **Step 4: 公開ページを確認**

```bash
sleep 90
URL=$(gh api "repos/{owner}/$REPO/pages" --jq '.html_url')
curl -s -o /dev/null -w '%{http_code}\n' "$URL"
curl -s -o /dev/null -w '%{http_code}\n' "${URL}data/mcu-works.json"
curl -s -o /dev/null -w '%{http_code}\n' "${URL}diagrams/avengers-doomsday.html"
```

Expected: 3つとも `200`。ブラウザで `$URL#graph` と `$URL#guide` を開き、図と予習マップが表示され、ポスターが読める（Task 4 Step 6 実施済みの場合）ことを確認する。

- [ ] **Step 5: 公開 URL を README に追記してコミット**

`README.md` の見出し `# MCU 作品カタログ` の直後の段落の末尾に、次の1行を追加する（URL は Step 4 のもの）:

```markdown
公開ページ: https://<owner>.github.io/<repo>/
```

```bash
git add README.md
git commit -m "docs: 公開 URL を追記" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CDBgQLWzDx432KMhCFnPG7"
git push
```

---

## 未決事項と後続

- Task 4 Step 6（ポスター取得）は TMDB API キーの取得後に実行する。実行後に `python3 scripts/build_diagrams.py` の再実行は不要（予習マップはポスターを使わない）。
- 短縮ルート（`essential`）と依存関係（`dependencies.json`）は草案。ユーザーが調整したら `npm run check` を通してコミットする。
- 『デアデビル：ボーン・アゲイン』S3 と 2028 年の3本は公開日・作中年代が確定していない。確定したら `data/mcu-works.json` を更新する。
