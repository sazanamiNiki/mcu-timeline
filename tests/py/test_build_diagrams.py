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
