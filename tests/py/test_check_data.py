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


class RealDataTest(unittest.TestCase):
    def test_real_data_passes(self):
        data = check_data.load(check_data.WORKS_PATH)
        self.assertEqual(check_data.check_all(data), [])
        self.assertEqual(len(check_data.included(data)), 63)


if __name__ == '__main__':
    unittest.main()
