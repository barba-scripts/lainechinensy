(() => {
  const dialog = document.querySelector('.latest-dialog');
  if (!dialog) return;
  const media = dialog.querySelector('.latest-preview-media');
  const safeImage = (value) => {
    try { const url = new URL(value, location.href); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
  };
  function thumbnail(entry) {
    const link = entry.querySelector('.latest-item');
    const src = link.dataset.previewImage && safeImage(link.dataset.previewImage);
    if (!src) return;
    const image = new Image();
    image.alt = '';
    image.loading = 'lazy';
    image.src = src;
    image.addEventListener('error', () => image.remove(), { once: true });
    entry.querySelector('.latest-thumb').append(image);
  }
  document.querySelectorAll('.latest-entry').forEach(entry => {
    thumbnail(entry);
    entry.querySelector('button').addEventListener('click', () => {
      const link = entry.querySelector('.latest-item');
      media.replaceChildren();
      const src = link.dataset.previewImage && safeImage(link.dataset.previewImage);
      if (src) {
        const image = new Image();
        image.alt = link.querySelector('strong').textContent;
        image.src = src;
        image.addEventListener('error', () => image.remove(), { once: true });
        media.append(image);
      }
      dialog.querySelector('#latest-preview-title').textContent = link.querySelector('strong').textContent;
      dialog.querySelector('#latest-preview-kind').textContent = link.querySelector('.latest-kind').textContent;
      dialog.querySelector('#latest-preview-excerpt').textContent = link.dataset.excerpt || '';
      const open = dialog.querySelector('#latest-preview-link');
      open.href = link.href;
      open.target = link.target;
      open.rel = 'noopener noreferrer';
      dialog.showModal();
    });
  });
  dialog.querySelector('.latest-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('#latest-preview-link').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  async function page(url) {
    const response = await fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Content unavailable');
    return new DOMParser().parseFromString(await response.text(), 'text/html');
  }
  async function youtube() {
    const doc = await page('gospel.html');
    const video = doc.querySelector('.gospel-video');
    const id = video?.querySelector('iframe')?.getAttribute('src')?.match(/\/embed\/([\w-]{11})/)?.[1];
    if (!id) return;
    const entry = document.querySelector('[data-latest="youtube"]');
    const link = entry.querySelector('a');
    link.href = `https://www.youtube.com/watch?v=${id}`;
    link.querySelector('strong').textContent = video.querySelector('h3').textContent;
    link.dataset.previewImage = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    entry.querySelector('.latest-thumb img')?.remove();
    thumbnail(entry);
  }
  async function recollection() {
    const archive = 'https://lainechinensy.github.io/falzchen/Recollection-Logs/';
    const doc = await page(archive);
    const entries = Array.from(doc.querySelectorAll('.section-li')).map(item => {
      const a = item.querySelector('.desc a');
      if (!a) return null;
      const url = new URL(a.getAttribute('href'), archive);
      if (url.origin !== new URL(archive).origin || !url.pathname.startsWith('/falzchen/Recollection-Logs/')) return null;
      const title = a.textContent.trim();
      return { title, url: url.href, number: Number(title.match(/\bLog\s+No\.?\s*(\d+)/i)?.[1] ?? -1), date: Date.parse(item.querySelector('time')?.getAttribute('datetime') || '') || 0 };
    }).filter(Boolean).sort((a,b) => b.number - a.number || b.date - a.date);
    if (!entries.length) return;
    const latest = entries[0];
    const entry = document.querySelector('[data-latest="recollection"]');
    const link = entry.querySelector('a');
    link.href = latest.url;
    link.querySelector('strong').textContent = latest.title;
    const article = (await page(latest.url)).querySelector('article');
    const image = article?.querySelector('img[src]');
    if (image) { link.dataset.previewImage = new URL(image.getAttribute('src'), latest.url).href; thumbnail(entry); }
    link.dataset.excerpt = Array.from(article?.querySelectorAll('p') || []).map(p => p.textContent.trim()).filter(Boolean).join(' ').slice(0, 400);
  }
  const diary = document.querySelector('.blog-entry');
  if (diary) {
    const link = document.querySelector('[data-latest="diary"] a');
    const heading = diary.querySelector('h3');
    if (heading?.id) { link.href = '#' + heading.id; link.querySelector('strong').textContent = heading.textContent; }
    link.dataset.excerpt = diary.querySelector('.prose')?.textContent || '';
  }
  Promise.allSettled([youtube(), recollection()]);
})();
