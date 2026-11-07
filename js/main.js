// Quiet, synthesized hover sounds shared by every page.
(() => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const preferenceKey = 'solumbra-link-sounds';
  let enabled = true;
  try { enabled = localStorage.getItem(preferenceKey) !== 'off'; } catch { /* Storage may be unavailable. */ }
  let context;
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
  // Prepare audio immediately on browsers that already allow this site's sounds.
  unlock();
  function play() {
    if (!enabled || context?.state !== 'running') return;
    // Leave the audio thread time to receive the complete envelope on phones.
    const now = context.currentTime + 0.02;
    const duration = 0.22;
    const frequencies = [880, 1320];
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.985, now + duration);
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(0.018 / (index + 1), now + 0.015);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration - 0.02);
      envelope.gain.linearRampToValueAtTime(0, now + duration);
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
    if (enabled) unlock();
  });
  // Capture gestures early; touch browsers may only activate audio on release.
  document.addEventListener('pointerdown', unlock, { passive: true, capture: true });
  document.addEventListener('pointerup', unlock, { passive: true, capture: true });
  document.addEventListener('click', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const link = event.target.closest?.('a[href]');
    if (!link || (event.relatedTarget instanceof Node && link.contains(event.relatedTarget))) return;
    unlock();
    const now = performance.now();
    if (now - lastHover < 90) return;
    lastHover = now;
    play();
  });
  document.addEventListener('focusin', event => {
    if (event.target.matches?.('a[href]:focus-visible')) play();
  });

})();

// The browser draws the gold cursor through CSS, independent of JavaScript work.
// Only the optional click rings need DOM elements.
(() => {
  const allowed = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const modalOpen = () => Boolean(document.querySelector('dialog:modal'));
  allowed.addEventListener('change', () => {
    document.querySelectorAll('.cursor-ripple').forEach(ripple => ripple.remove());
  });
  document.addEventListener('pointerdown', event => {
    if (!allowed.matches || event.pointerType !== 'mouse' || event.button !== 0 || modalOpen()) return;
    const ripple = document.createElement('div');
    ripple.className = 'cursor-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.left = `${event.clientX}px`;
    ripple.style.top = `${event.clientY}px`;
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    document.body.append(ripple);
    // Also clean up if an animation is cancelled by a browser or stylesheet.
    window.setTimeout(() => ripple.remove(), 700);
  }, { passive: true });
})();

// Kuromega notices a still, visible page. Activity always returns to the page.
(() => {
  // The wolf arrives at five minutes: 4m30s stillness + two 15s warnings.
  const idleDelay = 270000;
  const stageDelay = 15000;
  const manualStageDelay = 15000;
  // Temporary testing display. Set to false to remove the countdown.
  const showEncounterCounter = true;
  const counter = document.createElement('div');
  counter.className = 'kuromega-counter';
  counter.setAttribute('role', 'img');
  counter.innerHTML = `<svg viewBox="0 0 64 80" aria-hidden="true" fill="none">
    <circle cx="32" cy="9" r="6" stroke="currentColor" stroke-width="2"/>
    <path d="M27 16h10v7H27zM48 22l5 5" stroke="currentColor" stroke-width="2"/>
    <circle cx="32" cy="48" r="27" fill="#121117" stroke="currentColor" stroke-width="2"/>
    <circle cx="32" cy="48" r="22" stroke="currentColor" opacity=".25"/>
    <circle class="watch-progress" cx="32" cy="48" r="22" pathLength="100" stroke="currentColor" stroke-width="2" stroke-dasharray="0 100" transform="rotate(-90 32 48)"/>
    <path d="M32 24v4m24 20h-4M32 72v-4M8 48h4" stroke="currentColor"/>
    <path class="watch-hand" d="M32 48V32" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M32 48l-8 6" stroke="currentColor" stroke-linecap="round"/>
    <circle cx="32" cy="48" r="2.5" fill="currentColor"/>
  </svg>`;
  const watchProgress = counter.querySelector('.watch-progress');
  const watchHand = counter.querySelector('.watch-hand');
  if (showEncounterCounter) document.body.append(counter);
  let nextStageAt = 0;
  const encounter = document.createElement('div');
  encounter.className = 'kuromega-encounter';
  encounter.hidden = true;
  const stars = document.createElement('div');
  stars.className = 'kuromega-stars';
  stars.setAttribute('aria-hidden', 'true');
  const shadow = document.createElement('div');
  shadow.className = 'kuromega-shadow';
  shadow.setAttribute('aria-hidden', 'true');
  const silhouette = document.createElement('div');
  silhouette.className = 'kuromega-silhouette';
  silhouette.setAttribute('aria-hidden', 'true');
  const fog = document.createElement('div');
  fog.className = 'kuromega-fog';
  fog.setAttribute('aria-hidden', 'true');
  const copy = document.createElement('div');
  copy.className = 'kuromega-copy';
  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  const hint = document.createElement('p');
  hint.className = 'kuromega-hint';
  hint.textContent = 'Move, scroll, press a key, or tap to return.';
  copy.append(message, hint);
  encounter.append(stars, shadow, silhouette, fog, copy);
  document.body.append(encounter);
  let timer;
  let passageTimer;
  let manual = false;
  let stage = 0;
  const messages = [
    'Something has noticed your stillness.',
    'The stars are going quiet.',
    'Kuromega draws near.'
  ];
  function updateCounter() {
    if (!showEncounterCounter) return;
    let label;
    let progress = 0;
    if (document.hidden || !document.hasFocus()) {
      label = 'Kuromega encounter paused';
    } else if (document.activeElement instanceof HTMLIFrameElement) {
      label = 'Kuromega encounter paused while an embedded player is focused';
    } else if (stage === messages.length) {
      label = manual ? 'Kuromega draws near. Press Escape to dismiss.' : 'Kuromega draws near. Move to dismiss.';
      progress = 1;
    } else {
      const seconds = Math.max(0, Math.ceil((nextStageAt - performance.now()) / 1000));
      const duration = stage === 0 ? idleDelay : (manual ? manualStageDelay : stageDelay);
      progress = Math.min(1, Math.max(0, 1 - (nextStageAt - performance.now()) / duration));
      label = stage === 0
        ? `Kuromega approaches in ${seconds} seconds of stillness`
        : `Kuromega encounter: stage ${stage} of 3, next in ${seconds} seconds`;
    }
    counter.setAttribute('aria-label', label);
    counter.title = label;
    counter.dataset.stage = String(stage);
    watchProgress.setAttribute('stroke-dasharray', `${progress * 100} 100`);
    watchHand.setAttribute('transform', `rotate(${progress * 360} 32 48)`);
  }

  function advance() {
    // Leave embedded players and background tabs undisturbed.
    if (document.hidden || !document.hasFocus() || document.activeElement instanceof HTMLIFrameElement) {
      reset();
      return;
    }
    // Activity moves the deadline without rebuilding timers or changing the DOM
    // on every pointer event. Re-arm only when the previous deadline arrives.
    const remaining = nextStageAt - performance.now();
    if (remaining > 0) {
      timer = window.setTimeout(advance, remaining);
      return;
    }
    stage++;
    encounter.hidden = false;
    encounter.dataset.stage = String(stage);
    message.textContent = messages[stage - 1];
    if (stage === messages.length) {
      document.body.classList.add('kuromega-passing');
      passageTimer = window.setTimeout(reset, 24000);
    }
    if (stage < messages.length) {
      const delay = manual ? manualStageDelay : stageDelay;
      nextStageAt = performance.now() + delay;
      timer = window.setTimeout(advance, delay);
    }
    updateCounter();
  }
  function reset() {
    window.clearTimeout(timer);
    window.clearTimeout(passageTimer);
    manual = false;
    document.body.classList.remove('kuromega-passing');
    hint.textContent = 'Move, scroll, press a key, or tap to return.';
    stage = 0;
    encounter.hidden = true;
    message.textContent = '';
    delete encounter.dataset.stage;
    if (!document.hidden && document.hasFocus()) {
      nextStageAt = performance.now() + idleDelay;
      timer = window.setTimeout(advance, idleDelay);
    }
    updateCounter();
  }
  ['pointermove', 'pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart', 'input'].forEach(type => {
    document.addEventListener(type, () => {
      // Let the tester move the mouse without cancelling the wolf's passage.
      if (manual && type === 'pointermove') return;
      if (stage > 0) reset();
      else nextStageAt = performance.now() + idleDelay;
    }, { passive: true, capture: true });
  });
  document.querySelector('[data-kuromega-trigger]')?.addEventListener('click', () => {
    reset();
    window.clearTimeout(timer);
    manual = true;
    stage = 0;
    nextStageAt = performance.now();
    hint.textContent = 'Press Escape, scroll, click, or tap to return.';
    advance();
  });
  document.addEventListener('visibilitychange', reset);
  window.addEventListener('blur', reset);
  window.addEventListener('focus', reset);
  window.addEventListener('pageshow', reset);
  if (showEncounterCounter) window.setInterval(updateCounter, 1000);
  reset();
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

// Praise is an explicit action, limited to one per browser per Manila day.
(() => {
  const panel = document.querySelector('[data-voidling-counter]');
  if (!panel) return;
  const button = panel.querySelector('[data-praise-button]');
  const value = panel.querySelector('[data-counter-placeholder]');
  const status = panel.querySelector('[data-counter-status]');
  const endpoint = window.VOID_PRAISE_ENDPOINT || '/api/praise';
  let visitor;
  let busy = false;
  let resetTimer;
  try {
    visitor = localStorage.getItem('void-praise-visitor');
    if (!visitor || !/^[a-f0-9-]{36}$/i.test(visitor)) {
      visitor = crypto.randomUUID();
      localStorage.setItem('void-praise-visitor', visitor);
    }
  } catch {
    status.textContent = 'Allow browser storage to offer your daily praise.';
    return;
  }
  async function update(method = 'GET') {
    if (busy) return;
    busy = true;
    button.disabled = true;
    if (method === 'POST') button.textContent = 'Offering praise?';
    try {
      const response = await fetch(endpoint, {
        method, headers: { 'X-Voidling-ID': visitor }, cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Praise unavailable');
      const data = await response.json();
      if (!Number.isSafeInteger(data.total) || data.total < 0
          || typeof data.praised !== 'boolean' || !Number.isFinite(Date.parse(data.nextReset))) {
        throw new Error('Invalid praise response');
      }
      value.textContent = data.total.toLocaleString();
      value.removeAttribute('aria-hidden');
      button.disabled = data.praised;
      button.textContent = data.praised ? 'Praised today ?' : 'Praise the Void Sun';
      status.textContent = data.praised
        ? 'Your voice has joined the choir. Return after midnight Philippine time.'
        : 'One offering each day. The choir renews at midnight Philippine time.';
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => update(), Math.max(1000, Date.parse(data.nextReset) - Date.now() + 1000));
    } catch {
      button.disabled = false;
      button.textContent = method === 'POST' ? 'Try praise again' : 'Retry connection';
      status.textContent = 'The choir cannot be reached. Please try again; your praise has not been confirmed.';
      button.dataset.retry = method === 'POST' ? 'POST' : 'GET';
      return;
    } finally {
      busy = false;
    }
    delete button.dataset.retry;
  }
  button.addEventListener('click', () => update(button.dataset.retry || 'POST'));
  window.addEventListener('focus', () => update());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
  update();
})();

// Add Instagram artwork in small batches instead of loading the entire portfolio at once.
const artworkGallery = document.querySelector('#artwork-gallery');
const moreArtwork = document.querySelector('#more-artwork');
const loadMoreArtwork = document.querySelector('#load-more-artwork');
if (artworkGallery && moreArtwork && loadMoreArtwork) {
  loadMoreArtwork.hidden = false;
  loadMoreArtwork.addEventListener('click', () => {
    const cards = Array.from(moreArtwork.content.children).slice(0, 6);
    cards.forEach((card, index) => {
      card.classList.add('load-more-reveal');
      card.style.setProperty('--reveal-delay', `${index * 40}ms`);
      artworkGallery.append(card);
    });
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

// Reveal below-the-fold content once, without hiding it while waiting.
(() => {
  const main = document.querySelector('main');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!main || !('IntersectionObserver' in window) || reducedMotion.matches) return;
  const selector = '.section-header, article, .feature, .split > *, .connect-hub > *, .connect-platforms > a';
  const registered = new WeakSet();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      if (!reducedMotion.matches) entry.target.classList.add('scroll-reveal');
    });
  }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });

  function registerContent() {
    main.querySelectorAll(selector).forEach(element => {
      if (registered.has(element) || element.classList.contains('load-more-reveal')) return;
      registered.add(element);
      // Keep the initial view and nested content steady.
      if (element.parentElement.closest(selector) || element.getBoundingClientRect().top < window.innerHeight) return;
      observer.observe(element);
    });
  }
  registerContent();
  // Include artwork and archive entries added by Load more.
  new MutationObserver(registerContent).observe(main, { childList: true, subtree: true });
  main.addEventListener('animationend', event => {
    if (event.animationName === 'content-scroll-reveal') event.target.classList.remove('scroll-reveal');
  });
})();

// A decorative star field behind the page, shared by every route.
(() => {
  const stars = document.createElement('div');
  stars.className = 'ambient-stars';
  stars.setAttribute('aria-hidden', 'true');
  document.body.prepend(stars);
})();
