// Deploy separately from GitHub Pages with a Cloudflare D1 binding named DB.
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = ['https://lainechinensy.net', 'https://www.lainechinensy.net', 'https://lainechinensy.github.io'];
    const headers = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'Vary': 'Origin',
      ...(allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    };
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
    if (!allowed.includes(origin)) return reply({ error: 'Origin not allowed' }, 403);
    if (new URL(request.url).pathname !== '/api/praise') return reply({ error: 'Not found' }, 404);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      ...headers, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Voidling-ID',
    } });
    if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'Method not allowed' }, 405);
    const visitor = request.headers.get('X-Voidling-ID') || '';
    if (!/^[a-f0-9-]{36}$/i.test(visitor)) return reply({ error: 'Invalid browser ID' }, 400);
    const now = new Date();
    // Shift to Philippine time before taking the calendar day (no DST).
    const day = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
    const nextReset = new Date(Date.parse(`${day}T00:00:00+08:00`) + 86400000).toISOString();
    try {
      const statements = [];
      if (request.method === 'POST') statements.push(env.DB.prepare(
        'INSERT OR IGNORE INTO praise (day, visitor) VALUES (?, ?)'
      ).bind(day, visitor));
      statements.push(env.DB.prepare('SELECT COUNT(*) AS total FROM praise'));
      statements.push(env.DB.prepare('SELECT 1 FROM praise WHERE day=? AND visitor=?').bind(day, visitor));
      // The uniqueness constraint and transactional batch make duplicate clicks safe.
      const results = await env.DB.batch(statements);
      return reply({ total: results.at(-2).results[0].total, praised: results.at(-1).results.length > 0, nextReset });
    } catch {
      return reply({ error: 'Praise temporarily unavailable' }, 503);
    }
  },
};
