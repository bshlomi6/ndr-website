#!/usr/bin/env python3
"""
Dev server for the נ.ד.ר site with a built-in visual editor.

Serves the site normally, but injects the floating editor into every HTML
response. The editor is never written into the source files — publish the
site as-is and no editor code goes with it.

Usage:
    python3 editor/server.py [port]
"""

import base64
import datetime
import json
import os
import posixpath
import re
import shutil
import sys
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# Project root = parent of the editor/ directory holding this file.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EDITOR_DIR = os.path.join(ROOT, "editor")
BACKUP_DIR = os.path.join(EDITOR_DIR, "backups")
IMAGES_DIR = os.path.join(ROOT, "assets", "images")

INJECT = (
    '<link rel="stylesheet" href="/__editor/editor.css">\n'
    '<script src="/__editor/editor.js" defer></script>\n'
)

SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]+$")


def inside(path, parent):
    """True when `path` really lives under `parent` (blocks ../ escapes)."""
    path = os.path.realpath(path)
    parent = os.path.realpath(parent)
    return path == parent or path.startswith(parent + os.sep)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))

    # ---------- helpers ----------

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self, limit=64 * 1024 * 1024):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > limit:
            return None
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def no_store(self):
        # Editing is useless if the browser serves a stale page.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")

    # ---------- GET ----------

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path

        if path.startswith("/__editor/"):
            return self.serve_editor_asset(path)

        if path == "/__editor-pages":
            pages = sorted(
                f for f in os.listdir(ROOT)
                if f.endswith(".html") and os.path.isfile(os.path.join(ROOT, f))
            )
            return self.send_json({"pages": pages})

        local = self.translate_path(self.path)
        if os.path.isdir(local):
            local = os.path.join(local, "index.html")

        if local.endswith(".html") and os.path.isfile(local):
            return self.serve_html(local)

        return super().do_GET()

    def end_headers(self):
        # בפיתוח אף פעם לא רוצים קאש — אחרת עריכות CSS/JS לא נראות
        if "Cache-Control" not in self._headers_buffer_names():
            self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def _headers_buffer_names(self):
        out = []
        for raw in getattr(self, "_headers_buffer", []):
            try:
                line = raw.decode("latin-1")
            except Exception:
                continue
            if ":" in line:
                out.append(line.split(":", 1)[0].strip())
        return out

    def serve_editor_asset(self, path):
        name = posixpath.basename(path)
        if not SAFE_NAME.match(name):
            return self.send_error(404)
        local = os.path.join(EDITOR_DIR, name)
        if not (inside(local, EDITOR_DIR) and os.path.isfile(local)):
            return self.send_error(404)
        ctype = "text/css; charset=utf-8" if name.endswith(".css") \
            else "application/javascript; charset=utf-8"
        with open(local, "rb") as fh:
            body = fh.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.no_store()
        self.end_headers()
        self.wfile.write(body)

    def serve_html(self, local):
        with open(local, "r", encoding="utf-8") as fh:
            html = fh.read()
        rel = os.path.relpath(local, ROOT).replace(os.sep, "/")
        tag = INJECT + '<meta name="x-editor-file" content="%s">\n' % rel
        if "</body>" in html:
            html = html.replace("</body>", tag + "</body>", 1)
        else:
            html += tag
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.no_store()
        self.end_headers()
        self.wfile.write(body)

    # ---------- POST ----------

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        try:
            if path == "/__editor/save":
                return self.handle_save()
            if path == "/__editor/upload":
                return self.handle_upload()
        except Exception as exc:  # surface the reason in the editor UI
            return self.send_json({"ok": False, "error": str(exc)}, 500)
        self.send_error(404)

    def handle_save(self):
        data = self.read_json()
        if not data:
            return self.send_json({"ok": False, "error": "בקשה ריקה"}, 400)

        rel = (data.get("file") or "").lstrip("/")
        html = data.get("html")
        if not rel.endswith(".html") or "/" in rel or not html:
            return self.send_json({"ok": False, "error": "שם קובץ לא תקין"}, 400)

        target = os.path.join(ROOT, rel)
        if not (inside(target, ROOT) and os.path.isfile(target)):
            return self.send_json({"ok": False, "error": "הקובץ לא נמצא"}, 404)

        os.makedirs(BACKUP_DIR, exist_ok=True)
        stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        shutil.copy2(target, os.path.join(BACKUP_DIR, "%s.%s.bak" % (rel, stamp)))

        with open(target, "w", encoding="utf-8") as fh:
            fh.write(html)

        return self.send_json({"ok": True, "file": rel, "backup": stamp})

    def handle_upload(self):
        data = self.read_json()
        if not data:
            return self.send_json({"ok": False, "error": "בקשה ריקה"}, 400)

        name = os.path.basename(data.get("name") or "")
        payload = data.get("data") or ""
        if "," in payload:
            payload = payload.split(",", 1)[1]

        stem, ext = os.path.splitext(name)
        if ext.lower() not in (".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"):
            return self.send_json({"ok": False, "error": "סוג קובץ לא נתמך"}, 400)

        stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-") or "image"
        os.makedirs(IMAGES_DIR, exist_ok=True)

        final = "%s%s" % (stem, ext.lower())
        i = 2
        while os.path.exists(os.path.join(IMAGES_DIR, final)):
            final = "%s-%d%s" % (stem, i, ext.lower())
            i += 1

        dest = os.path.join(IMAGES_DIR, final)
        if not inside(dest, IMAGES_DIR):
            return self.send_json({"ok": False, "error": "נתיב לא תקין"}, 400)

        with open(dest, "wb") as fh:
            fh.write(base64.b64decode(payload))

        return self.send_json({"ok": True, "src": "assets/images/%s" % final})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
    os.chdir(ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("\n  עורך האתר פועל")
    print("  ↪  http://localhost:%d/index.html" % port)
    print("  תיקיית האתר: %s" % ROOT)
    print("  גיבויים נשמרים ב: editor/backups/\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  השרת נעצר.\n")


if __name__ == "__main__":
    main()
