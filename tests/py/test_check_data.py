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
