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
