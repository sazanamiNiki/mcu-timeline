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
