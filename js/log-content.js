// Copy article formatting while resolving wiki links and excluding executable markup.
function copyLogContent(source, baseUrl) {
  const allowed = new Set(['P', 'BR', 'STRONG', 'EM', 'B', 'I', 'U', 'S', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'HR', 'A', 'IMG', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'FIGURE', 'FIGCAPTION']);
  const skip = new Set(['SCRIPT', 'STYLE', 'BUTTON', 'IFRAME', 'OBJECT', 'SVG', 'FORM']);
  function copy(node) {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
    const fragment = document.createDocumentFragment();
    if (node.nodeType !== Node.ELEMENT_NODE || skip.has(node.tagName)) return fragment;
    const result = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : fragment;
    if (node.tagName === 'A' || node.tagName === 'IMG') {
      const attribute = node.tagName === 'A' ? 'href' : 'src';
      const value = node.getAttribute(attribute);
      if (value) {
        try {
          const url = new URL(value, baseUrl);
          if (['https:', 'http:'].includes(url.protocol)) result.setAttribute(attribute, url.href);
        } catch { /* Leave malformed links inactive. */ }
      }
      if (node.tagName === 'IMG') {
        result.alt = node.getAttribute('alt') || '';
        result.loading = 'lazy';
      }
    }
    node.childNodes.forEach(child => result.append(copy(child)));
    return result;
  }
  const content = document.createDocumentFragment();
  source.childNodes.forEach(node => content.append(copy(node)));
  return content;
}
