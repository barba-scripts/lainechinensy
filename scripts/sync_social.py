"""Update existing embed containers; credentials stay in the runner environment."""
import html
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]


class NotConfigured(Exception):
    pass


def api(url, params, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    request = Request(url + "?" + urlencode(params), headers=headers)
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def youtube():
    key = os.environ.get("YOUTUBE_API_KEY")
    if not key:
        raise NotConfigured("YOUTUBE_API_KEY is missing")
    base = "https://www.googleapis.com/youtube/v3/"
    channel = api(base + "channels", {
        "part": "contentDetails", "forHandle": "@lainechinensy", "key": key,
    })["items"][0]
    playlist = channel["contentDetails"]["relatedPlaylists"]["uploads"]
    items = api(base + "playlistItems", {
        "part": "snippet", "playlistId": playlist, "maxResults": 50, "key": key,
    })["items"]
    ids = [item["snippet"]["resourceId"]["videoId"] for item in items]
    if not ids:
        raise ValueError("YouTube returned no uploads")
    # Exclude private, deleted, and non-embeddable uploads.
    videos = api(base + "videos", {
        "part": "snippet,status", "id": ",".join(ids), "key": key,
    })["items"]
    by_id = {v["id"]: v for v in videos
             if v["status"].get("embeddable") and v["status"].get("privacyStatus") == "public"}
    return [by_id[i] for i in ids if i in by_id][:5]


def instagram():
    token = os.environ.get("INSTAGRAM_ACCESS_TOKEN")
    user = os.environ.get("INSTAGRAM_USER_ID", "")
    version = os.environ.get("INSTAGRAM_API_VERSION", "v25.0")
    if not token or not user.isdigit():
        raise NotConfigured("INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_USER_ID is missing")
    if not re.fullmatch(r"v\d+\.0", version):
        raise ValueError("Invalid INSTAGRAM_API_VERSION")
    login = os.environ.get("INSTAGRAM_LOGIN_MODE", "instagram")
    hosts = {"instagram": "graph.instagram.com", "facebook": "graph.facebook.com"}
    if login not in hosts:
        raise ValueError("Invalid INSTAGRAM_LOGIN_MODE")
    # Unified Login system-user tokens use the Facebook Graph API host.
    items = api(f"https://{hosts[login]}/{version}/{user}/media", {
        "fields": "permalink,timestamp", "limit": 100,
    }, token)["data"]
    items.sort(key=lambda item: item["timestamp"], reverse=True)
    return [item["permalink"].split("?")[0] for item in items
            if re.fullmatch(r"https://www\.instagram\.com/(?:p|reel)/[\w-]+/?", item.get("permalink", "").split("?")[0])]


def render_youtube(page, videos):
    if not videos:
        raise ValueError("No public embeddable videos; keeping saved embeds")
    pattern = r'(<div class="gospel-video-grid">)(.*?)(\s*</div>)'
    match = re.search(pattern, page, re.S)
    if not match:
        raise ValueError("YouTube container missing")
    template = re.search(r'<article class="gospel-video">.*?</article>', match[2], re.S)[0]
    cards = []
    for video in videos:
        if not re.fullmatch(r"[\w-]{11}", video["id"]):
            raise ValueError("Invalid YouTube video ID")
        title = html.escape(video["snippet"]["title"], quote=True)
        card = re.sub(r"<h3>.*?</h3>", lambda _: f"<h3>{title}</h3>", template, flags=re.S)
        card = re.sub(r'title="[^"]*"', lambda _: f'title="{title}"', card)
        card = re.sub(r'https://www.youtube.com/embed/[\w-]+', lambda _: "https://www.youtube.com/embed/" + video["id"], card)
        cards.append(card)
    body = "\n                    " + "\n                    ".join(cards)
    return page[:match.start(2)] + body + page[match.end(2):]


def render_instagram(page, links):
    if not links:
        raise ValueError("Instagram returned no usable posts; keeping saved embeds")
    pattern = r'(<div class="cards instagram-gallery" id="artwork-gallery">)(.*?)(\s*</div>\s*<template id="more-artwork">)(.*?)(\s*</template>)'
    match = re.search(pattern, page, re.S)
    if not match:
        raise ValueError("Instagram containers missing")
    saved = re.findall(r'data-instgrm-permalink="([^"]+)"', match[2] + match[4])
    links = list(dict.fromkeys(links + saved))
    template = re.search(r'<article class="card instagram-card">.*?</article>', match[2], re.S)[0]
    cards = []
    for link in links:
        if not re.fullmatch(r"https://www\.instagram\.com/(?:p|reel)/[\w-]+/?", link):
            raise ValueError("Invalid Instagram permalink")
        cards.append(re.sub(r'https://www.instagram.com/(?:p|reel)/[\w-]+/?', lambda _: link, template))
    join = lambda batch: "\n                    " + "\n                    ".join(batch)
    return (page[:match.start(2)] + join(cards[:6]) + match[3]
            + join(cards[6:]) + page[match.start(5):])


def render_latest_instagram(page, link):
    if not re.fullmatch(r"https://www\.instagram\.com/(?:p|reel)/[\w-]+/?", link):
        raise ValueError("Invalid Instagram permalink")
    pattern = r'(<!-- latest-content:start -->\s*<a class="latest-item" href=")[^"]+("[^>]*>)'
    updated, count = re.subn(pattern, lambda match: match[1] + link + match[2], page)
    if count != 1:
        raise ValueError("Latest content link missing")
    return updated


def main():
    failures = 0
    for name, filename, fetch, render in [
        ("YouTube", "gospel.html", youtube, render_youtube),
        ("Instagram", "art.html", instagram, render_instagram),
    ]:
        try:
            path = ROOT / filename
            page = path.read_text(encoding="utf-8")
            content = fetch()
            updated = render(page, content)
            homepage = ROOT / 'index.html'
            if name == 'Instagram' and homepage.exists():
                home = homepage.read_text(encoding='utf-8')
                latest = render_latest_instagram(home, content[0])
                if latest != home:
                    homepage.write_text(latest, encoding='utf-8', newline='\n')
            if updated != page:
                path.write_text(updated, encoding="utf-8", newline="\n")
            print(f"{name}: checked successfully")
        except NotConfigured:
            print(f"::warning::{name} is not configured yet; saved embeds retained.")
        except HTTPError as error:
            # Only expose structured error codes, never URLs, tokens, or messages.
            reason = "unknown"
            try:
                details = json.load(error).get('error', {})
                reason = details.get('errors', [{}])[0].get('reason', 'unknown')
                if not re.fullmatch(r'[A-Za-z0-9_]+', str(reason)):
                    reason = "unknown"
            except Exception:
                pass
            print(f"::error::{name} API returned HTTP {error.code}, reason={reason}. Saved embeds retained.")
            failures += 1
        except Exception:
            # Request errors may contain credential-bearing URLs; never print them.
            print(f"::error::{name} sync failed. Saved embeds retained. Check credentials, API access, and container markup.")
            failures += 1
    return bool(failures)


if __name__ == "__main__":
    sys.exit(main())
