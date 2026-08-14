#!/usr/bin/env python3
"""Local dashboard server with workbook write-back (127.0.0.1 only)."""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException

ROOT = Path(__file__).resolve().parent.parent
DASHBOARD = Path(__file__).resolve().parent
DEFAULT_SYNC = DASHBOARD / "check_back_default.xlsx"
MAX_WORKBOOK_BYTES = int(os.environ.get("CHECK_BACK_MAX_SAVE_BYTES", str(50 * 1024 * 1024)))


def resolve_workbook_path() -> Path:
    raw = os.environ.get("CHECK_BACK_XLSX", "").strip()
    if raw:
        path = Path(raw)
        if not path.is_absolute():
            path = ROOT / path
    else:
        path = ROOT / "output" / "Check_Back_standardized.xlsx"
    return path.resolve()


WORKBOOK = resolve_workbook_path()

app = Flask(__name__)


@app.errorhandler(HTTPException)
def handle_http_error(exc: HTTPException):
    return jsonify({"ok": False, "error": exc.description}), exc.code


@app.get("/api/workbook-info")
def workbook_info():
    parent = WORKBOOK.parent
    return jsonify(
        {
            "ok": True,
            "path": str(WORKBOOK),
            "exists": WORKBOOK.is_file(),
            "writable": parent.exists() and os.access(parent, os.W_OK),
            "saveEnabled": True,
        }
    )


@app.post("/api/save-workbook")
def save_workbook():
    data = request.get_data()
    if not data:
        abort(400, description="Empty workbook body")
    if len(data) > MAX_WORKBOOK_BYTES:
        abort(413, description="Workbook exceeds size limit")

    parent = WORKBOOK.parent
    if not parent.exists():
        abort(500, description=f"Workbook directory does not exist: {parent}")
    if not os.access(parent, os.W_OK):
        abort(500, description=f"Workbook directory is not writable: {parent}")

    tmp = WORKBOOK.with_suffix(WORKBOOK.suffix + ".tmp")
    backup = WORKBOOK.with_suffix(WORKBOOK.suffix + ".bak")

    try:
        if WORKBOOK.is_file():
            shutil.copy2(WORKBOOK, backup)
        tmp.write_bytes(data)
        tmp.replace(WORKBOOK)
        shutil.copy2(WORKBOOK, DEFAULT_SYNC)
    except OSError as exc:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        abort(500, description=f"Could not write workbook: {exc}")

    return jsonify(
        {
            "ok": True,
            "path": str(WORKBOOK),
            "bytes": len(data),
            "syncedDefault": str(DEFAULT_SYNC),
            "backup": str(backup) if backup.is_file() else None,
        }
    )


@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def serve_dashboard(path: str):
    if path.startswith("api/"):
        abort(404)
    target = (DASHBOARD / path).resolve()
    try:
        target.relative_to(DASHBOARD.resolve())
    except ValueError:
        abort(404)
    if target.is_file():
        return send_from_directory(DASHBOARD, path)
    if path in ("", "index.html"):
        return send_from_directory(DASHBOARD, "index.html")
    abort(404)


def main() -> None:
    port = int(os.environ.get("PORT", "8765"))
    host = "127.0.0.1"
    print(f"Check Back dashboard: http://{host}:{port}/index.html")
    print(f"Save target (CHECK_BACK_XLSX): {WORKBOOK}")
    print("Press Ctrl+C to stop.")
    app.run(host=host, port=port, debug=False, threaded=True)


if __name__ == "__main__":
    main()
