import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import sync_social as sync


class SocialSyncTests(unittest.TestCase):
    def setUp(self):
        # Simulated API failures must not create real GitHub Actions annotations.
        output = patch.object(sync, 'print', create=True)
        output.start()
        self.addCleanup(output.stop)

    def test_missing_credentials_skip_without_failing(self):
        with patch.object(sync, 'youtube', side_effect=sync.NotConfigured), patch.object(sync, 'instagram', side_effect=sync.NotConfigured):
            self.assertFalse(sync.main())

    def test_instagram_login_endpoint_and_newest_first(self):
        response = {'data': [
            {'permalink': 'https://www.instagram.com/p/OLDER/', 'timestamp': '2026-11-01'},
            {'permalink': 'https://www.instagram.com/reel/NEWER/?tracking=1', 'timestamp': '2026-11-07'},
        ]}
        with patch.dict('os.environ', {'INSTAGRAM_ACCESS_TOKEN': 'test-token', 'INSTAGRAM_USER_ID': '123', 'INSTAGRAM_API_VERSION': 'v25.0'}), patch.object(sync, 'api', return_value=response) as request:
            self.assertEqual(sync.instagram(), ['https://www.instagram.com/reel/NEWER/', 'https://www.instagram.com/p/OLDER/'])
            request.assert_called_once_with('https://graph.instagram.com/v25.0/123/media', {'fields': 'permalink,timestamp,media_type,media_url,thumbnail_url', 'limit': 100}, 'test-token')

    def test_reel_thumbnail_updates_and_escapes_homepage_metadata(self):
        response = {'data': [{'permalink': 'https://www.instagram.com/reel/NEWEST/', 'timestamp': '2026-11-07', 'media_type': 'VIDEO', 'media_url': 'https://cdn.example/video.mp4', 'thumbnail_url': 'https://cdn.example/preview.jpg?a=1&b=2'}]}
        with patch.dict('os.environ', {'INSTAGRAM_ACCESS_TOKEN': 'test', 'INSTAGRAM_USER_ID': '123'}), patch.object(sync, 'api', return_value=response):
            posts = sync.instagram()
        self.assertEqual(posts.preview_image, 'https://cdn.example/preview.jpg?a=1&b=2')
        page = (sync.ROOT / 'index.html').read_text(encoding='utf-8')
        updated = sync.render_latest_instagram(page, posts[0], posts.preview_image)
        self.assertIn('data-preview-image="https://cdn.example/preview.jpg?a=1&amp;b=2"', updated)
        self.assertNotIn('video.mp4', updated)
        self.assertIn('data-latest="youtube"', updated)
        self.assertIn('data-latest="recollection"', updated)

    def test_unified_login_uses_facebook_graph(self):
        with patch.dict('os.environ', {'INSTAGRAM_ACCESS_TOKEN': 'test-token', 'INSTAGRAM_USER_ID': '123', 'INSTAGRAM_API_VERSION': 'v25.0', 'INSTAGRAM_LOGIN_MODE': 'facebook'}), patch.object(sync, 'api', return_value={'data': []}) as request:
            self.assertEqual(sync.instagram(), [])
            request.assert_called_once_with('https://graph.facebook.com/v25.0/123/media', {'fields': 'permalink,timestamp,media_type,media_url,thumbnail_url', 'limit': 100}, 'test-token')

    def test_invalid_login_mode_rejected_before_request(self):
        with patch.dict('os.environ', {'INSTAGRAM_ACCESS_TOKEN': 'test-token', 'INSTAGRAM_USER_ID': '123', 'INSTAGRAM_LOGIN_MODE': 'example.com'}), patch.object(sync, 'api') as request:
            with self.assertRaises(ValueError):
                sync.instagram()
            request.assert_not_called()

    def test_latest_link_updates_without_changing_other_homepage_content(self):
        page = (sync.ROOT / 'index.html').read_text(encoding='utf-8')
        link = 'https://www.instagram.com/reel/NEWEST/'
        updated = sync.render_latest_instagram(page, link)
        self.assertIn('href="' + link + '"', updated)
        self.assertEqual(updated.split('<!-- latest-content:start -->')[0], page.split('<!-- latest-content:start -->')[0])
        self.assertEqual(updated.split('<!-- latest-content:end -->')[1], page.split('<!-- latest-content:end -->')[1])
        self.assertIn('music.html#featured-album', updated)
        self.assertEqual(sync.render_latest_instagram(updated, link), updated)
        with self.assertRaises(ValueError):
            sync.render_latest_instagram(page, 'javascript:alert(1)')

    def test_instagram_preserves_archive_batches_and_layout(self):
        page = (sync.ROOT / 'art.html').read_text(encoding='utf-8')
        saved = re.findall(r'data-instgrm-permalink="([^"]+)"', page)
        new = 'https://www.instagram.com/p/NEW_POST/'
        result = sync.render_instagram(page, [new, saved[0], new])
        links = re.findall(r'data-instgrm-permalink="([^"]+)"', result)
        self.assertEqual(links, [new] + saved)
        gallery = result.split('id="artwork-gallery">')[1].split('</div>')[0]
        self.assertEqual(gallery.count('class="card instagram-card"'), 6)
        self.assertEqual(result.split('id="artwork-gallery">')[0], page.split('id="artwork-gallery">')[0])
        self.assertEqual(result.split('</template>')[1], page.split('</template>')[1])
        self.assertEqual(sync.render_instagram(result, [new, saved[0]]), result)

    def test_youtube_escapes_titles_and_preserves_player_options(self):
        page = (sync.ROOT / 'gospel.html').read_text(encoding='utf-8')
        videos = [{'id': 'abcdefghijk', 'snippet': {'title': 'A < B & "C"'}}]
        result = sync.render_youtube(page, videos)
        self.assertIn('A &lt; B &amp; &quot;C&quot;', result)
        self.assertEqual(result.count('class="gospel-video"'), 1)
        self.assertIn('allowfullscreen', result)
        self.assertIn('aspect-ratio:16/9', result)
        self.assertIn('/embed/abcdefghijk', result)
        self.assertEqual(sync.render_youtube(result, videos), result)

    def test_youtube_api_filters_unavailable_videos(self):
        responses = [
            {'items': [{'contentDetails': {'relatedPlaylists': {'uploads': 'playlist'}}}]},
            {'items': [{'snippet': {'resourceId': {'videoId': v}}} for v in ['private', 'blocked', 'public']]},
            {'items': [
                {'id': 'private', 'status': {'privacyStatus': 'private', 'embeddable': True}},
                {'id': 'blocked', 'status': {'privacyStatus': 'public', 'embeddable': False}},
                {'id': 'public', 'status': {'privacyStatus': 'public', 'embeddable': True}},
            ]},
        ]
        with patch.dict('os.environ', {'YOUTUBE_API_KEY': 'test'}), patch.object(sync, 'api', side_effect=responses):
            self.assertEqual([v['id'] for v in sync.youtube()], ['public'])

    def test_failed_source_keeps_saved_content_and_other_source_updates(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for filename in ['art.html', 'gospel.html']:
                (root / filename).write_bytes((sync.ROOT / filename).read_bytes())
            original = (root / 'gospel.html').read_bytes()
            with patch.object(sync, 'ROOT', root), patch.object(sync, 'youtube', side_effect=TimeoutError), patch.object(sync, 'instagram', return_value=['https://www.instagram.com/p/NEW_POST/']):
                self.assertTrue(sync.main())
            self.assertEqual((root / 'gospel.html').read_bytes(), original)
            self.assertIn('NEW_POST', (root / 'art.html').read_text(encoding='utf-8'))

    def test_empty_feeds_do_not_replace_saved_embeds(self):
        for filename, render in [('art.html', sync.render_instagram), ('gospel.html', sync.render_youtube)]:
            with self.assertRaises(ValueError):
                render((sync.ROOT / filename).read_text(encoding='utf-8'), [])


if __name__ == '__main__':
    unittest.main()
