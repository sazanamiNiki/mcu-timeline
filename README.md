# MCU 作品カタログ

マーベル・シネマティック・ユニバースの実写映画とドラマを、公開順・作中の時系列・依存関係図・ガイドの4つの見方で一覧する静的サイト。

## ローカルで見る

```bash
python3 -m http.server 8000
```

`http://localhost:8000/` を開く。ビルドは不要。

`index.html` を直接開く（`file://`）と ES モジュールと fetch が動かないため、必ず上のサーバー経由で開く。

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
