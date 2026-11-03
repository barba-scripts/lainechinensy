// Quiet, synthesized link sounds shared by every page.
(() => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const preferenceKey = 'solumbra-link-sounds';
  let enabled = true;
  try { enabled = localStorage.getItem(preferenceKey) !== 'off'; } catch { /* Storage may be unavailable. */ }
  let context;
  // Prepare the audio graph early; playback still waits for a user gesture.
  try { if (enabled) context = new AudioContext({ latencyHint: 'interactive' }); } catch { /* Retry on interaction. */ }
  let pressedLink = null;
  let lastHover = -Infinity;
  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'sound-toggle';
  function updateControl() {
    control.textContent = `Sound: ${enabled ? 'on' : 'off'}`;
    control.setAttribute('aria-label', 'Link sounds');
    control.setAttribute('aria-pressed', String(enabled));
  }
  updateControl();
  (document.querySelector('.footer-inner') || document.body).append(control);

  function unlock() {
    if (!enabled) return;
    try {
      context ||= new AudioContext({ latencyHint: 'interactive' });
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch { /* Keep navigation working if audio is unavailable. */ }
  }
  function play(click = false) {
    if (!enabled || context?.state !== 'running') return;
    const now = context.currentTime;
    const duration = click ? 0.36 : 0.22;
    const frequencies = click ? [220, 330, 660] : [880, 1320];
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.985, now + duration);
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime((click ? 0.035 : 0.018) / (index + 1), now + 0.003);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(envelope);
      envelope.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    });
  }
  control.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(preferenceKey, enabled ? 'on' : 'off'); } catch { /* Use the preference for this page. */ }
    updateControl();
    if (enabled) { unlock(); context?.resume().then(() => play()).catch(() => {}); }
  });
  function playClick() {
    unlock();
    if (context?.state === 'running') play(true);
    else context?.resume().then(() => play(true)).catch(() => {});
  }
  document.addEventListener('pointerdown', event => {
    unlock();
    pressedLink = event.button === 0 ? event.target.closest?.('a[href]') : null;
    if (pressedLink) playClick();
  }, { passive: true });
  document.addEventListener('pointercancel', () => { pressedLink = null; });
  document.addEventListener('keydown', unlock);
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const link = event.target.closest?.('a[href]');
    if (!link || (event.relatedTarget instanceof Node && link.contains(event.relatedTarget))) return;
    const now = performance.now();
    if (now - lastHover < 90) return;
    lastHover = now;
    play();
  });
  document.addEventListener('focusin', event => {
    if (event.target.matches?.('a[href]:focus-visible')) play();
  });
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    const alreadyPlayed = event.detail > 0 && link === pressedLink;
    pressedLink = null;
    if (link && !alreadyPlayed) playClick();
  });
})();

// Shared mobile navigation. Edit content directly in each HTML file.
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-links');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Menu';
  }));
}
document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

// Add Instagram artwork in small batches instead of loading the entire portfolio at once.
const artworkGallery = document.querySelector('#artwork-gallery');
const moreArtwork = document.querySelector('#more-artwork');
const loadMoreArtwork = document.querySelector('#load-more-artwork');
if (artworkGallery && moreArtwork && loadMoreArtwork) {
  loadMoreArtwork.hidden = false;
  loadMoreArtwork.addEventListener('click', () => {
    const cards = Array.from(moreArtwork.content.children).slice(0, 6);
    cards.forEach(card => artworkGallery.append(card));
    window.instgrm?.Embeds?.process();
    loadMoreArtwork.hidden = !moreArtwork.content.childElementCount;
  });
}
// Keep the homepage preview in sync on load, tab return, and while browsing.
const artworkPreview = document.querySelector('[data-artwork-preview]');
if (artworkPreview && ['http:', 'https:'].includes(window.location.protocol)) {
  let previewSignature = '';
  let previewLoading = false;
  async function refreshArtworkPreview() {
    if (previewLoading || document.hidden) return;
    previewLoading = true;
    try {
      const response = await fetch('art.html', { cache: 'no-store' });
      if (!response.ok) throw new Error('Artwork page could not be loaded.');
      const artworkPage = new DOMParser().parseFromString(await response.text(), 'text/html');
      const cards = Array.from(artworkPage.querySelectorAll('#artwork-gallery > .instagram-card')).slice(0, 3);
      const signature = cards.map(card => card.outerHTML).join('');
      if (!cards.length || signature === previewSignature) return;
      artworkPreview.replaceChildren(...cards.map(card => document.importNode(card, true)));
      previewSignature = signature;
      if (window.instgrm?.Embeds) {
        window.instgrm.Embeds.process();
      } else {
        document.querySelector('script[src="https://www.instagram.com/embed.js"]')
          ?.addEventListener('load', () => window.instgrm?.Embeds?.process(), { once: true });
      }
    } catch (error) {
      console.warn('Using saved artwork preview:', error);
    } finally {
      previewLoading = false;
    }
  }
  refreshArtworkPreview();
  window.addEventListener('focus', refreshArtworkPreview);
  document.addEventListener('visibilitychange', refreshArtworkPreview);
  window.setInterval(refreshArtworkPreview, 30000);
}
// Mirror the featured album, including its Spotify player, on the homepage.
const albumPreview = document.querySelector('[data-album-preview]');
if (albumPreview && ['http:', 'https:'].includes(window.location.protocol)) {
  let albumSignature = '';
  let albumLoading = false;
  async function refreshAlbumPreview() {
    if (albumLoading || document.hidden) return;
    albumLoading = true;
    try {
      const response = await fetch('music.html', { cache: 'no-store' });
      if (!response.ok) throw new Error('Music page could not be loaded.');
      const musicPage = new DOMParser().parseFromString(await response.text(), 'text/html');
      const featuredAlbum = musicPage.querySelector('#featured-album');
      if (!featuredAlbum) return;
      const preview = document.importNode(featuredAlbum, true);
      preview.removeAttribute('id');
      const signature = preview.outerHTML;
      if (signature === albumSignature) return;
      const current = albumPreview.firstElementChild;
      if (!current || current.outerHTML !== signature) albumPreview.replaceChildren(preview);
      albumSignature = signature;
    } catch (error) {
      console.warn('Using saved album preview:', error);
    } finally {
      albumLoading = false;
    }
  }
  refreshAlbumPreview();
  window.addEventListener('focus', refreshAlbumPreview);
  document.addEventListener('visibilitychange', refreshAlbumPreview);
  window.setInterval(refreshAlbumPreview, 30000);
}
// Preview the archive entry with the highest log number.
const recollectionPreview = document.querySelector('[data-recollection-preview]');
if (recollectionPreview) {
  const archiveUrl = 'https://lainechinensy.github.io/falzchen/Recollection-Logs/';
  const fullLog = recollectionPreview.querySelector('[data-log-full]');
  const expandLog = recollectionPreview.querySelector('[data-log-expand]');
  expandLog.addEventListener('click', () => {
    const open = expandLog.getAttribute('aria-expanded') !== 'true';
    fullLog.hidden = !open;
    recollectionPreview.querySelector('[data-log-excerpt]').hidden = open;
    expandLog.setAttribute('aria-expanded', String(open));
    expandLog.textContent = open ? 'Show less' : 'Expand full text';
    if (!open) recollectionPreview.scrollIntoView({ block: 'start' });
  });
  let logLoading = false;
  let loadedLog = '';
  async function refreshRecollection() {
    if (logLoading || document.hidden) return;
    logLoading = true;
    try {
      const listingResponse = await fetch(archiveUrl, { cache: 'no-store' });
      if (!listingResponse.ok) throw new Error('Archive unavailable.');
      const listing = new DOMParser().parseFromString(await listingResponse.text(), 'text/html');
      const entries = Array.from(listing.querySelectorAll('.section-li')).map(item => {
        const link = item.querySelector('.desc a');
        const date = Date.parse(item.querySelector('time')?.getAttribute('datetime') || '');
        if (!link) return null;
        const url = new URL(link.getAttribute('href'), archiveUrl);
        if (url.origin !== new URL(archiveUrl).origin || !url.pathname.startsWith('/falzchen/Recollection-Logs/')) return null;
        const title = link.textContent.trim();
        const numberMatch = title.match(/\bLog\s+No\.?\s*(\d+)/i);
        const number = numberMatch ? Number(numberMatch[1]) : -1;
        return { title, url: url.href, number, date: Number.isFinite(date) ? date : 0 };
      }).filter(Boolean).sort((a, b) => b.number - a.number || b.date - a.date);
      const latest = entries[0];
      if (!latest || latest.url === loadedLog) return;
      const response = await fetch(latest.url, { cache: 'no-store' });
      if (!response.ok) throw new Error('Log unavailable.');
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      const article = page.querySelector('article');
      if (!article) return;
      article.querySelectorAll('script, style, .clipboard-button, .heading-anchor').forEach(node => node.remove());
      const sourceImage = article.querySelector('img[src]');
      const artwork = recollectionPreview.querySelector('[data-log-artwork]');
      const image = recollectionPreview.querySelector('[data-log-image]');
      artwork.hidden = true;
      if (sourceImage) {
        const imageUrl = new URL(sourceImage.getAttribute('src'), latest.url);
        if (imageUrl.protocol === 'https:') {
          image.src = imageUrl.href;
          image.alt = sourceImage.getAttribute('alt') || `Artwork for ${latest.title}`;
          artwork.hidden = false;
        }
      }
      const fullArticle = article.cloneNode(true);
      if (sourceImage) fullArticle.querySelector('img[src]')?.remove();
      fullLog.replaceChildren(copyLogContent(fullArticle, latest.url));
      fullLog.hidden = true;
      recollectionPreview.querySelector('[data-log-excerpt]').hidden = false;
      expandLog.hidden = false;
      expandLog.setAttribute('aria-expanded', 'false');
      expandLog.textContent = 'Expand full text';
      article.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
      const paragraphs = Array.from(article.querySelectorAll('p'))
        .flatMap(p => p.textContent.split(/\n/))
        .map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (!paragraphs.length) return;
      const excerpt = document.createDocumentFragment();
      let length = 0;
      let count = 0;
      for (const text of paragraphs) {
        if (count >= 6 || (length + text.length > 600 && count > 0)) break;
        const paragraph = document.createElement('p');
        paragraph.textContent = text.length > 600 ? text.slice(0, 600).replace(/\s+\S*$/, '') + '…' : text;
        excerpt.append(paragraph);
        length += text.length;
        count++;
      }
      if (count < paragraphs.length) {
        const continuation = document.createElement('p');
        continuation.textContent = '…';
        excerpt.append(continuation);
      }
      recollectionPreview.querySelector('[data-log-title]').textContent = latest.title;
      recollectionPreview.querySelector('[data-log-excerpt]').replaceChildren(excerpt);
      recollectionPreview.querySelector('[data-log-link]').href = latest.url;
      loadedLog = latest.url;
    } catch (error) {
      console.warn('Using saved recollection preview:', error);
    } finally {
      logLoading = false;
    }
  }
  refreshRecollection();
  window.addEventListener('focus', refreshRecollection);
  window.setInterval(refreshRecollection, 300000);
}
const recollectionImage = document.querySelector('[data-log-image]');
recollectionImage?.addEventListener('error', () => { recollectionImage.closest('[data-log-artwork]').hidden = true; });
