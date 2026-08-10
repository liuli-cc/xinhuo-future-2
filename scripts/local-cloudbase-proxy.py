#!/usr/bin/env python3
"""Local development proxy for CloudBase.

The Codex in-app browser may block direct requests to *.service.tcloudbase.com.
This proxy keeps browser traffic on localhost and forwards it with the macOS
system TLS trust chain. It is only for local development and test sessions.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


UPSTREAM_ORIGIN = os.environ.get(
    "XINHUO_CLOUDBASE_ORIGIN",
    "https://xinhuo-d8gxyksn2f7095c5a.service.tcloudbase.com",
).rstrip("/")
LISTEN_HOST = os.environ.get("XINHUO_PROXY_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("XINHUO_PROXY_PORT", "4174"))
MAX_REQUEST_BYTES = 8 * 1024 * 1024


class CloudBaseProxyHandler(BaseHTTPRequestHandler):
    server_version = "XinhuoLocalProxy/1.0"

    def _cors_headers(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin in {"http://localhost:4173", "http://127.0.0.1:4173"}:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "authorization, content-type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Max-Age", "600")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def _proxy(self) -> None:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length > MAX_REQUEST_BYTES:
            self._json_error(413, "本地代理请求超过 8MB")
            return

        body = self.rfile.read(length) if length else None
        headers: dict[str, str] = {}
        for name in ("Authorization", "Content-Type", "Accept"):
            value = self.headers.get(name)
            if value:
                headers[name] = value

        request = urllib.request.Request(
            f"{UPSTREAM_ORIGIN}{self.path}",
            data=body,
            headers=headers,
            method=self.command,
        )
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = response.read()
                self.send_response(response.status)
                self.send_header("Content-Type", response.headers.get("Content-Type", "application/json; charset=utf-8"))
                self.send_header("Cache-Control", "no-store")
                self._cors_headers()
                self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as error:
            payload = error.read()
            self.send_response(error.code)
            self.send_header("Content-Type", error.headers.get("Content-Type", "application/json; charset=utf-8"))
            self.send_header("Cache-Control", "no-store")
            self._cors_headers()
            self.end_headers()
            self.wfile.write(payload)
        except Exception as error:
            self._json_error(502, f"本地代理连接云端失败：{error}")

    def _json_error(self, status: int, message: str) -> None:
        payload = json.dumps({"error": message}, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self._cors_headers()
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:  # noqa: N802
        self._proxy()

    def do_POST(self) -> None:  # noqa: N802
        self._proxy()

    def do_PUT(self) -> None:  # noqa: N802
        self._proxy()

    def do_PATCH(self) -> None:  # noqa: N802
        self._proxy()

    def do_DELETE(self) -> None:  # noqa: N802
        self._proxy()

    def log_message(self, format_string: str, *args: object) -> None:
        print(f"[xinhuo-local-proxy] {self.address_string()} {format_string % args}", flush=True)


if __name__ == "__main__":
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), CloudBaseProxyHandler)
    print(
        f"Xinhuo local CloudBase proxy: http://{LISTEN_HOST}:{LISTEN_PORT} -> {UPSTREAM_ORIGIN}",
        flush=True,
    )
    server.serve_forever()
