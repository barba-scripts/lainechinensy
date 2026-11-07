// A shared explanation below the invitations keeps nearby links unobscured.
(() => {
  const invitations = document.querySelector('.sanctum-invitations');
  if (!invitations) return;
  const panel = document.createElement('div');
  panel.className = 'sanctum-explanation';
  panel.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'sanctum-explanation-label';
  label.textContent = 'Hint';
  const text = document.createElement('span');
  panel.append(label, text);
  invitations.after(panel);
  invitations.classList.add('hints-enhanced');
  let hovered = null;
  let focused = null;
  const links = Array.from(invitations.querySelectorAll('a[aria-describedby]'));
  const center = invitations.querySelector('.quest-center');
  // Separate strokes make recognizable symbols while retaining star-chart lines.
  const shapes = {
    'hint-music': [ // Lyre and its strings.
      [[55,35],[65,55],[65,100],[78,126],[100,140],[122,126],[135,100],[135,55],[145,35]],
      [[65,55],[135,55]], [[82,55],[82,125]], [[100,55],[100,140]], [[118,55],[118,125]],
      [[55,35],[72,30]], [[145,35],[128,30]],
    ],
    'hint-lore': [ // Open book with a central spine.
      [[100,60],[72,45],[35,45],[35,125],[72,125],[100,140],[128,125],[165,125],[165,45],[128,45],[100,60],[100,140]],
      [[50,70],[73,70],[87,78]], [[50,93],[73,93],[87,101]],
      [[113,78],[127,70],[150,70]], [[113,101],[127,93],[150,93]],
    ],
    'hint-gospel': [ // A screen and play triangle.
      [[35,45],[165,45],[165,125],[35,125],[35,45]],
      [[85,65],[85,105],[120,85],[85,65]], [[100,125],[100,145]], [[75,145],[125,145]],
    ],
    'hint-art': [ // Diagonal paintbrush and pointed bristles.
      [[72,105],[137,35],[149,47],[88,119],[72,105]],
      [[72,105],[58,111],[52,131],[36,145],[65,141],[82,130],[88,119]],
      [[116,58],[130,71]],
    ],
    'hint-recollections': [ // Hourglass: fragments of remembered time.
      [[60,35],[140,35]], [[60,145],[140,145]],
      [[68,35],[68,60],[100,90],[132,120],[132,145]],
      [[132,35],[132,60],[100,90],[68,120],[68,145]],
      [[78,60],[122,60]], [[78,133],[100,112],[122,133],[78,133]],
    ],
    'hint-about': [ // Priestess crown with a central sacred star.
      [[45,70],[72,95],[100,45],[128,95],[155,70],[140,130],[60,130],[45,70]],
      [[60,143],[140,143]], [[100,70],[107,83],[100,96],[93,83],[100,70]],
    ],
    'hint-connect': [ // Two linked chain loops.
      [[92,60],[110,42],[137,42],[153,58],[153,80],[131,102],[110,102]],
      [[108,120],[90,138],[63,138],[47,122],[47,100],[69,78],[90,78]],
      [[77,113],[123,67]],
    ],
  };
  const ns = 'http://www.w3.org/2000/svg';
  let constellation;
  if (center) {
    constellation = document.createElementNS(ns, 'svg');
    constellation.classList.add('quest-constellation');
    constellation.setAttribute('viewBox', '0 0 200 180');
    constellation.setAttribute('aria-hidden', 'true');
    center.append(constellation);
  }
  let activeLink = null;
  function drawConstellation(link) {
    if (!center || !constellation || link === activeLink) return;
    activeLink = link;
    center.classList.toggle('has-constellation', Boolean(link));
    if (!link) return;
    const strokes = shapes[link.getAttribute('aria-describedby')];
    if (!strokes) return;
    const group = document.createElementNS(ns, 'g');
    if (link.getAttribute('aria-describedby') === 'hint-about') {
      const omega = document.createElementNS(ns, 'text');
      omega.classList.add('quest-omega');
      omega.setAttribute('x', '100');
      omega.setAttribute('y', '125');
      omega.setAttribute('text-anchor', 'middle');
      omega.textContent = '\u03a9';
      group.append(omega);
      constellation.replaceChildren(group);
      return;
    }
    if (link.getAttribute('aria-describedby') === 'hint-connect') {
      group.classList.add('quest-blackhole');
      const make = (tag, attributes, className) => {
        const element = document.createElementNS(ns, tag);
        Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
        element.setAttribute('class', className);
        return element;
      };
      group.append(make('circle', { cx: 100, cy: 90, r: 37 }, 'blackhole-lens'));
      const disk = make('g', {}, 'blackhole-disk');
      disk.append(make('ellipse', { cx: 100, cy: 90, rx: 78, ry: 22 }, 'blackhole-ring'));
      disk.append(make('ellipse', { cx: 100, cy: 90, rx: 70, ry: 16 }, 'blackhole-flow'));
      disk.append(make('circle', { cx: 162, cy: 82, r: 2.5 }, 'blackhole-spark'));
      group.append(disk);
      group.append(make('circle', { cx: 100, cy: 90, r: 28 }, 'blackhole-core'));
      group.append(make('ellipse', { cx: 100, cy: 90, rx: 77, ry: 21, 'stroke-dasharray': '115 250', 'stroke-dashoffset': '-8' }, 'blackhole-foreground'));
      constellation.replaceChildren(group);
      return;
    }
    strokes.forEach(points => {
      const path = document.createElementNS(ns, 'polyline');
      path.setAttribute('points', points.map(point => point.join(',')).join(' '));
      group.append(path);
    });
    const seen = new Set();
    strokes.flat().forEach(([x,y], index) => {
      if (seen.has(`${x},${y}`)) return;
      seen.add(`${x},${y}`);
      const star = document.createElementNS(ns, 'circle');
      star.setAttribute('cx', x);
      star.setAttribute('cy', y);
      star.setAttribute('r', index === 0 ? '3' : '2');
      group.append(star);
    });
    constellation.replaceChildren(group);
  }
  function update() {
    const link = hovered || focused;
    text.textContent = link?.querySelector('.hero-hint')?.textContent || '';
    panel.classList.toggle('is-visible', Boolean(link));
    drawConstellation(link);
  }
  links.forEach(link => {
    link.addEventListener('pointerenter', () => { hovered = link; update(); });
    link.addEventListener('pointerleave', () => { hovered = null; update(); });
    link.addEventListener('focus', () => { focused = link; update(); });
    link.addEventListener('blur', () => { focused = null; update(); });
    link.addEventListener('click', () => { hovered = focused = null; update(); });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { hovered = focused = null; update(); }
  });
})();
