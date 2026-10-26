"""Локальный макет сервера для проверки без Google.

Повторяет поведение apps-script/Code.gs и раздаёт файлы сайта.
Запуск: python3 -I tools/mock_server.py  →  http://localhost:8765
Пароли ведущей в макете: test1 и test2.
"""
import json
import os
import sys
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASSWORDS = {'1': 'test1', '2': 'test2'}
records = []  # {club, id, name, company, updated, data}
states = {}
lock = Lock()


class AuthError(Exception):
    pass


def check_host(req):
    if str(req.get('pass')) != PASSWORDS[req['club']]:
        raise AuthError('auth')


def club_records(club):
    return [r for r in records if r['club'] == club]


def handle(req):
    club = str(req.get('club', ''))
    if club not in PASSWORDS:
        raise AuthError('club')
    req['club'] = club
    op = req.get('op')
    if op == 'get':
        mine = [r for r in club_records(club) if r['id'] == req.get('id')]
        return {'data': mine[0]['data'] if mine else None}
    if op == 'save':
        line = {'club': club, 'id': str(req['id']), 'name': req.get('name', ''), 'company': req.get('company', ''),
                'updated': datetime.now(timezone.utc).isoformat(), 'data': req.get('data') or {}}
        for i, r in enumerate(records):
            if r['club'] == club and r['id'] == line['id']:
                records[i] = line
                return {}
        records.append(line)
        return {}
    if op == 'pub':
        recs = club_records(club)
        me = str(req.get('id', ''))
        helps = [{'fromName': r['name'], 'fromCompany': r['company'], 'text': h['text']}
                 for r in recs for h in (r['data'].get('helps') or [])
                 if h and h.get('to') == me and h.get('text')]
        return {'state': states.get(club, {}),
                'roster': [{'id': r['id'], 'name': r['name'], 'company': r['company']} for r in recs],
                'helps': helps}
    if op == 'auth':
        check_host(req)
        return {}
    if op == 'all':
        check_host(req)
        return {'state': states.get(club, {}),
                'records': [{k: r[k] for k in ('id', 'name', 'company', 'updated', 'data')} for r in club_records(club)]}
    if op == 'setState':
        check_host(req)
        st = dict(states.get(club, {}))
        st.update(req.get('patch') or {})
        states[club] = st
        return {'state': st}
    if op == 'reset':
        check_host(req)
        records[:] = [r for r in records if r['club'] != club]
        states[club] = {'epoch': int(datetime.now().timestamp() * 1000)}
        return {}
    raise AuthError('op')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        try:
            with lock:
                res = handle(json.loads(body))
            res['ok'] = True
        except Exception as e:  # noqa: BLE001
            res = {'ok': False, 'error': str(e)}
        out = json.dumps(res, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(out)))
        self.end_headers()
        self.wfile.write(out)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
