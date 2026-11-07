"""Local static preview with a durable, browser/day praise API. Not a public server."""
from datetime import datetime, timedelta, timezone
from contextlib import closing
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import re
import sqlite3
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
MANILA = timezone(timedelta(hours=8))
DATABASE = ROOT / '.local' / 'praise.sqlite3'


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path.split('?')[0] == '/api/praise':
            self.praise(False)
        elif any(part.startswith('.') for part in unquote(self.path).split('/')):
            self.send_error(404)
        else:
            super().do_GET()

    def do_POST(self):
        if self.path != '/api/praise':
            self.send_error(404)
            return
        if self.headers.get('Origin') not in (None, f'http://{self.headers.get("Host")}'):
            self.send_error(403)
            return
        self.praise(True)

    def praise(self, submit):
        visitor = self.headers.get('X-Voidling-ID', '')
        if not re.fullmatch(r'[a-fA-F0-9-]{36}', visitor):
            self.send_error(400)
            return
        now = datetime.now(MANILA)
        day = now.date().isoformat()
        DATABASE.parent.mkdir(exist_ok=True)
        with closing(sqlite3.connect(DATABASE, timeout=15)) as db, db:
            db.execute('CREATE TABLE IF NOT EXISTS praise (day TEXT NOT NULL, visitor TEXT NOT NULL, PRIMARY KEY(day, visitor))')
            if submit:
                db.execute('INSERT OR IGNORE INTO praise VALUES (?, ?)', (day, visitor))
            total = db.execute('SELECT COUNT(*) FROM praise').fetchone()[0]
            praised = db.execute('SELECT 1 FROM praise WHERE day=? AND visitor=?', (day, visitor)).fetchone() is not None
        reset = datetime.combine(now.date() + timedelta(days=1), datetime.min.time(), MANILA)
        body = json.dumps({'total': total, 'praised': praised, 'nextReset': reset.isoformat()}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f'Preview: http://127.0.0.1:{port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
