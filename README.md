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

Upload the contents of this folder to the root of your GitHub Pages repository, then configure Settings > Pages to deploy from main / root. For a custom domain, set it in Pages and configure your domain's DNS records.

The character illustration is provided by the user and remains their material. Google Fonts are optional; fallback fonts are included.
