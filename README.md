# Laine Chinensy — Void Sanctuary

Static HTML/CSS/JavaScript website for GitHub Pages, redesigned around the supplied Void Priestess character illustration. No build tools required.

## Preview
Open `index.html` in a browser or use VS Code Live Server.

## Customize
- `css/style.css`: change the colors in the `:root` block (charcoal, silver, gold, lavender, crimson).
- `index.html`: edit the homepage text, sections, and links.
- `music.html`, `art.html`, `about.html`: edit the other pages.
- `images/laine-void-priestess.png`: supplied character illustration used on the homepage.
- Replace the decorative LACUNA album placeholder with your actual cover.
- Replace Bandcamp/Spotify/YouTube placeholder homepage links with your artist profile URLs.
- Wiki currently links to https://lainechinensy.github.io/falzchen/; change it if you later use a custom wiki subdomain.

## Daily praise and cursor

The footer counts explicit Praise button submissions, not page visits. Each
browser may praise once per calendar day, resetting at midnight Asia/Manila.
An anonymous random browser ID is stored in localStorage. A server-side unique
constraint prevents repeat requests from that ID counting twice in a day,
including concurrent clicks, retries, and navigation between pages. Clearing
storage, using another browser, or making up a new ID bypasses this soft limit;
this is a community interaction, not a verified one-person voting system.
No Meta token or Instagram connection is involved.

Preview with `python scripts/preview.py`, then open http://127.0.0.1:8000.
The local API stores its separate preview count in ignored `.local/praise.sqlite3`.
It never changes the production count. Merely loading a page does not add praise.
The UI handles loading, unavailable service, confirmation, and the daily reset.

GitHub Pages cannot run the praise API. A production Cloudflare Worker + D1
implementation is prepared in `praise-api/`; it has not been provisioned or deployed:

1. Sign in to Cloudflare with Wrangler, then run `npx wrangler d1 create void-sun-praise`
   from `praise-api/`.
2. Put the returned database ID in `praise-api/wrangler.jsonc`.
3. From `praise-api/`, run `npx wrangler d1 execute void-sun-praise --remote --file=schema.sql`.
4. Run `npx wrangler deploy` from that directory.
5. Set `window.VOID_PRAISE_ENDPOINT` in `js/praise-config.js` to the deployed
   Worker's HTTPS URL ending in `/api/praise`, then publish the GitHub Pages changes.

Until the backend is connected, the public button reports the connection failure
rather than presenting a fake total or recording praise only on one device.
The API allows the site's three existing production origins and uses D1's
transactional batch API. A database uniqueness constraint supplies the daily limit.
See [D1 bindings and batch documentation](https://developers.cloudflare.com/d1/worker-api/d1-database/).
Checks: `node --test praise-api/test_worker.mjs` and the existing Python tests.

The gold spearhead is a CSS image cursor with a browser fallback. Text fields
retain text cursors; movement does not depend on JavaScript. Click rings respect
reduced motion. Idle activity updates the deadline without DOM writes or timer
recreation on each mouse movement.

## Homepage blog

The Sanctum homepage has a blog section below the introduction. To publish the first post, replace the `blog-empty` block in `index.html` with an article like the one below. Add later posts above older ones. Use the actual publication date and your own title and text.

```html
<article class="blog-entry">
    <time datetime="2026-11-04">November 4, 2026</time>
    <h3>Your post title</h3>
    <p class="prose">Your post text.</p>
</article>
```

## Publish on GitHub Pages

### Automatic YouTube and Instagram updates

The `Update social embeds` GitHub Actions workflow checks both accounts hourly
(at minute 17; GitHub schedules can be delayed), on pushes to main, and on manual
runs. It updates the existing HTML, commits changes, and deploys GitHub Pages.
The current CSS, YouTube player layout, Instagram cards, and six-card Load more
batches are preserved. YouTube displays the latest five public, embeddable videos
from the channel's 50 most recent uploads. Instagram checks the latest 100 posts,
places fetched posts newest first, and retains older saved cards without duplicates.
Reels are included. Deleted older Instagram posts are not automatically removed
from the saved archive; remove their cards manually if needed.

One-time setup in [the repository settings](https://github.com/lainechinensy/lainechinensy/settings):

1. Under **Secrets and variables > Actions**, add these repository secrets:
   - `YOUTUBE_API_KEY`: a Google Cloud API key with YouTube Data API v3 enabled.
     Restrict it to that API; browser referrer restrictions do not work for this runner.
   - `INSTAGRAM_USER_ID`: the numeric professional Instagram account ID, not the username.
   - `INSTAGRAM_ACCESS_TOKEN`: the token generated for your professional Instagram
     account. The workflow defaults to the Facebook Graph API for the Unified Login
     system-user configuration used during setup. The token needs permission to
     read that account's media (`instagram_basic` for the Facebook Login route).
     Use the numeric Instagram account ID shown with the connected account.
   - For a standalone Instagram Login token with `instagram_business_basic`, add
     an Actions **variable** named `INSTAGRAM_LOGIN_MODE` with value `instagram`.
     The default `facebook` mode uses `graph.facebook.com`; `instagram` uses
     `graph.instagram.com`. Never place the token in an Actions variable.
2. Under **Pages > Build and deployment**, choose **GitHub Actions** as the source.
   This workflow publishes the site for normal pushes as well as social updates.
3. Allow Actions to write repository contents. If branch protection blocks bot
   commits, configure an allowed automation path before enabling the schedule.
4. Push these changes to main, then open **Actions > Update social embeds > Run
   workflow** to verify the first live update. Missing credentials skip that source
   with a warning. Invalid/expired credentials mark the run as failed, retain the
   affected page's saved embeds, and still publish any
   successful source updates. Enable GitHub failed-workflow notifications.

The API version defaults to `v25.0`; override with the Actions variable
`INSTAGRAM_API_VERSION` when upgrading Meta versions. Tokens must be renewed or
replaced before expiration; the workflow does not store or refresh tokens.
Never put tokens in HTML, source files, or chat. No credentials are sent to site
visitors. Existing embeds remain visible during API outages.

API setup references: [YouTube uploads API](https://developers.google.com/youtube/data/reference/rest/v3/playlistItems),
[Meta's Instagram API documentation](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api).

Local checks: `python -m unittest discover -s scripts -p "test_*.py"`.
To sync locally, supply the same environment variables and run
`python scripts/sync_social.py`.

For automatic social updates, publish this folder at the repository root and use
the GitHub Actions Pages source described above. For a custom domain, set it in
Pages and configure your domain's DNS records; the workflow retains `CNAME`.

The character illustration is provided by the user and remains their material. Google Fonts are optional; fallback fonts are included.
