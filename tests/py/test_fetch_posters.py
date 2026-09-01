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
