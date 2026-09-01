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
