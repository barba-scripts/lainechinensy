import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './worker.mjs';

test('praise counts actions, handles duplicate/concurrent clicks, and renews at Manila midnight', async () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const DB = {
    prepare(query) {
      return { query, values: [], bind(...values) { this.values = values; return this; } };
    },
    async batch(statements) {
      sql.exec('BEGIN');
      try {
        const result = statements.map(s => ({ results: sql.prepare(s.query).all(...s.values) }));
        sql.exec('COMMIT');
        return result;
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  const RealDate = Date;
  let time = '2026-11-08T15:59:59Z';
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [time])); } };
  async function call(method = 'GET', visitor = '11111111-1111-4111-8111-111111111111', origin = 'https://lainechinensy.net') {
    return worker.fetch(new Request('https://praise.example/api/praise', {
      method, headers: { Origin: origin, 'X-Voidling-ID': visitor },
    }), { DB });
  }
  try {
    let data = await (await call()).json();
    assert.equal(data.total, 0);
    assert.equal(data.praised, false);
    assert.equal(data.nextReset, '2026-11-08T16:00:00.000Z');
    const clicks = await Promise.all(Array.from({ length: 10 }, () => call('POST')));
    assert.ok(clicks.every(r => r.status === 200));
    data = await (await call()).json();
    assert.equal(data.total, 1, 'duplicate submissions must count only once');
    assert.equal(data.praised, true);
    await call('POST', '22222222-2222-4222-8222-222222222222');
    assert.equal((await (await call()).json()).total, 2, 'another browser shares the same total');
    time = '2026-11-08T16:00:00Z';
    assert.equal((await (await call()).json()).praised, false, 'new Manila day permits praise');
    data = await (await call('POST')).json();
    assert.equal(data.total, 3);
    assert.equal(data.nextReset, '2026-11-09T16:00:00.000Z');
    assert.equal((await call('POST', 'invalid')).status, 400);
    assert.equal((await call('POST', undefined, 'https://untrusted.example')).status, 403);
    assert.equal((await call('DELETE')).status, 405);
    const preflight = await call('OPTIONS');
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://lainechinensy.net');
    const failed = await worker.fetch(new Request('https://praise.example/api/praise', {
      headers: { Origin: 'https://lainechinensy.net', 'X-Voidling-ID': '11111111-1111-4111-8111-111111111111' },
    }), { DB: { prepare() { throw new Error('Database offline'); } } });
    assert.equal(failed.status, 503);
  } finally {
    globalThis.Date = RealDate;
    sql.close();
  }
});
