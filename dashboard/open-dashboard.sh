#!/usr/bin/env bash
# Start local server (or reuse one on 8765) and open the dashboard in your browser.
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
"./sync-default-workbook.sh" 2>/dev/null || echo "Note: baseline not synced — run ./sync-default-workbook.sh or upload a workbook"

export CHECK_BACK_XLSX="${CHECK_BACK_XLSX:-$ROOT/output/Check_Back_standardized.xlsx}"
if [[ "$CHECK_BACK_XLSX" != /* ]]; then
  export CHECK_BACK_XLSX="$ROOT/$CHECK_BACK_XLSX"
fi

PY="python3"
if [ -x "$ROOT/.venv/bin/python" ]; then
  PY="$ROOT/.venv/bin/python"
fi

URL="http://127.0.0.1:8765/index.html"
PID="$(lsof -Pi :8765 -sTCP:LISTEN -t 2>/dev/null | head -1)"

if [ -n "$PID" ]; then
  echo "Using existing server on port 8765 (pid $PID)"
else
  PORT=8765
  for p in 8765 8766 8767 8768 8769; do
    if ! lsof -Pi :"$p" -sTCP:LISTEN -t >/dev/null 2>&1; then
      PORT=$p
      break
    fi
  done
  export PORT
  echo "Starting dashboard server on port $PORT (save target: $CHECK_BACK_XLSX)..."
  "$PY" "$ROOT/dashboard/serve_with_save.py" >/dev/null 2>&1 &
  sleep 0.5
  URL="http://127.0.0.1:${PORT}/index.html"
fi

echo "Opening $URL"
if command -v open >/dev/null 2>&1; then
  open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL"
else
  echo "Open this URL in your browser: $URL"
fi
