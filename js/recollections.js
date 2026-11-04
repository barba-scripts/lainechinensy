const logFeed = document.querySelector('#recollection-feed');
const logStatus = document.querySelector('#recollection-status');
const moreLogs = document.querySelector('#load-more-recollections');
const logArchive = 'https://lainechinensy.github.io/falzchen/Recollection-Logs/';
let feedEntries = [];
let nextLog = 0;

async function fetchLogPage(url) {
  const response = await fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Archive response: ${response.status}`);
  return new DOMParser().parseFromString(await response.text(), 'text/html');
}
function logElement(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}
async function createLogCard(entry) {
  const card = logElement('article', '', 'note recollection-feature');
  const copy = logElement('div', '', 'recollection-copy');
  copy.append(logElement('h2', entry.title, 'recollection-feed-title'));
  const excerpt = logElement('div', '', 'recollection-excerpt');
  const actions = logElement('div', '', 'actions');
  const link = logElement('a', 'Read on the wiki ↗', 'btn');
  link.href = entry.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  actions.append(link);
  copy.append(excerpt, actions);
  card.append(copy);
  try {
    const page = await fetchLogPage(entry.url);
    const article = page.querySelector('article');
    if (!article) throw new Error('Log text not found.');
    const sourceImage = article.querySelector('img[src]');
    if (sourceImage) {
      const url = new URL(sourceImage.getAttribute('src'), entry.url);
      if (url.protocol === 'https:') {
        const frame = logElement('div', '', 'recollection-artwork');
        const image = document.createElement('img');
        image.src = url.href;
        image.alt = sourceImage.getAttribute('alt') || `Artwork for ${entry.title}`;
        image.loading = 'lazy';
        image.addEventListener('error', () => frame.remove(), { once: true });
        frame.append(image);
        card.prepend(frame);
      }
    }
    article.querySelectorAll('script, style, .clipboard-button, .heading-anchor').forEach(node => node.remove());
    const fullText = logElement('div', '', 'recollection-excerpt recollection-full');
    fullText.id = `log-full-${entry.url.split('/').pop().replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    fullText.hidden = true;
    const fullArticle = article.cloneNode(true);
    if (sourceImage) fullArticle.querySelector('img[src]')?.remove();
    fullText.append(copyLogContent(fullArticle, entry.url));
    const expand = logElement('button', 'Expand full text', 'btn');
    expand.type = 'button';
    expand.setAttribute('aria-expanded', 'false');
    expand.setAttribute('aria-controls', fullText.id);
    expand.addEventListener('click', () => {
      const open = expand.getAttribute('aria-expanded') !== 'true';
      fullText.hidden = !open;
      excerpt.hidden = open;
      expand.setAttribute('aria-expanded', String(open));
      expand.textContent = open ? 'Show less' : 'Expand full text';
      if (!open) card.scrollIntoView({ block: 'start' });
    });
    copy.insertBefore(fullText, actions);
    actions.prepend(expand);
    article.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    const paragraphs = Array.from(article.querySelectorAll('p'))
      .flatMap(p => p.textContent.split(/\n/))
      .map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean);
    let length = 0;
    let count = 0;
    for (const text of paragraphs) {
      if (count >= 6 || (length + text.length > 600 && count > 0)) break;
      excerpt.append(logElement('p', text.length > 600 ? text.slice(0, 600).replace(/\s+\S*$/, '') + '…' : text));
      length += text.length;
      count++;
    }
    if (!count) excerpt.append(logElement('p', 'Open this recollection to read the full entry.'));
    else if (count < paragraphs.length) excerpt.append(logElement('p', '…'));
  } catch (error) {
    excerpt.append(logElement('p', 'The excerpt could not be loaded. You can still read this entry in the wiki.'));
  }
  return card;
}
async function loadLogBatch() {
  moreLogs.disabled = true;
  logStatus.textContent = 'Loading recollections…';
  const batch = feedEntries.slice(nextLog, nextLog + 6);
  const cards = await Promise.all(batch.map(createLogCard));
  if (nextLog > 0) {
    cards.forEach((card, index) => {
      card.classList.add('load-more-reveal');
      card.style.setProperty('--reveal-delay', `${index * 100}ms`);
    });
  }
  logFeed.append(...cards);
  nextLog += batch.length;
  moreLogs.hidden = nextLog >= feedEntries.length;
  moreLogs.disabled = false;
  logStatus.textContent = `Showing ${nextLog} of ${feedEntries.length} recollections.`;
}
(async () => {
  try {
    const page = await fetchLogPage(logArchive);
    const seen = new Set();
    feedEntries = Array.from(page.querySelectorAll('.section-li')).map(item => {
      const link = item.querySelector('.desc a');
      if (!link) return null;
      const url = new URL(link.getAttribute('href'), logArchive);
      if (url.origin !== new URL(logArchive).origin || !url.pathname.startsWith('/falzchen/Recollection-Logs/') || seen.has(url.href)) return null;
      seen.add(url.href);
      const date = Date.parse(item.querySelector('time')?.getAttribute('datetime') || '');
      const title = link.textContent.trim();
        const numberMatch = title.match(/\bLog\s+No\.?\s*(\d+)/i);
        const number = numberMatch ? Number(numberMatch[1]) : -1;
        return { title, url: url.href, number, date: Number.isFinite(date) ? date : 0 };
    }).filter(Boolean).sort((a, b) => b.number - a.number || b.date - a.date);
    if (!feedEntries.length) throw new Error('No recollections found.');
    await loadLogBatch();
    moreLogs.addEventListener('click', loadLogBatch);
  } catch (error) {
    logStatus.textContent = 'The recollection feed is unavailable right now. Visit the wiki archive below to read the logs.';
    console.warn('Recollection feed unavailable:', error);
  }
})();
