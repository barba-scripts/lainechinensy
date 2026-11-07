"""Update existing embed containers; credentials stay in the runner environment."""
import html
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


def api(url, params, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    request = Request(url + "?" + urlencode(params), headers=headers)
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def youtube():
    key = os.environ.get("YOUTUBE_API_KEY")
    if not key:
        raise ValueError("YOUTUBE_API_KEY is missing")
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
        raise ValueError("INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_USER_ID is missing")
    if not re.fullmatch(r"v\d+\.0", version):
        raise ValueError("Invalid INSTAGRAM_API_VERSION")
    # Facebook Login: professional Instagram account linked to a Facebook Page.
    items = api(f"https://graph.facebook.com/{version}/{user}/media", {
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


def main():
    failures = 0
    for name, filename, fetch, render in [
        ("YouTube", "gospel.html", youtube, render_youtube),
        ("Instagram", "art.html", instagram, render_instagram),
    ]:
        try:
            path = ROOT / filename
            page = path.read_text(encoding="utf-8")
            updated = render(page, fetch())
            if updated != page:
                path.write_text(updated, encoding="utf-8", newline="\n")
            print(f"{name}: checked successfully")
        except Exception:
            # Request errors may contain credential-bearing URLs; never print them.
            print(f"::error::{name} sync failed. Saved embeds retained. Check credentials, API access, and container markup.")
            failures += 1
    return bool(failures)


if __name__ == "__main__":
    sys.exit(main())
