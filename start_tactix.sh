#!/usr/bin/env bash

set -euo pipefail

# Resolve project paths
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Pick a Python interpreter
if [[ -x "$BACKEND_DIR/venv/bin/python" ]]; then
  BACKEND_PYTHON="$BACKEND_DIR/venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  BACKEND_PYTHON="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  BACKEND_PYTHON="$(command -v python)"
else
  echo "Error: Python was not found. Install Python or create backend/venv first."
  exit 1
fi

# Verify required tools
if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm was not found. Install Node.js first."
  exit 1
fi

if [[ ! -f "$BACKEND_DIR/app.py" ]]; then
  echo "Error: backend/app.py was not found."
  exit 1
fi

# Check backend dependencies
if ! (
  cd "$BACKEND_DIR"
  "$BACKEND_PYTHON" -c "import flask, flask_cors, flask_limiter" >/dev/null 2>&1
); then
  echo "Error: Backend dependencies are missing. Run 'cd backend && source venv/bin/activate && python -m pip install -r ../requirements.txt' first."
  exit 1
fi

# Check frontend dependencies
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Error: frontend/node_modules was not found. Run 'cd frontend && npm install' first."
  exit 1
fi

if ! (
  cd "$FRONTEND_DIR"
  npm ls --depth=0 >/dev/null 2>&1
); then
  echo "Error: Frontend dependencies are incomplete. Run 'cd frontend && npm install' first."
  exit 1
fi

# Track child process PIDs
PIDS=()

# Stop child processes on exit
cleanup() {
  local exit_code=${1:-0}

  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done

  wait >/dev/null 2>&1 || true
  exit "$exit_code"
}

trap 'cleanup 0' INT TERM
trap 'cleanup $?' EXIT

# Wait until any child exits
wait_for_first_exit() {
  while true; do
    for pid in "${PIDS[@]}"; do
      if ! kill -0 "$pid" >/dev/null 2>&1; then
        wait "$pid"
        return $?
      fi
    done
    sleep 1
  done
}

# Start the backend service
echo "Starting backend with: $BACKEND_PYTHON app.py"
(
  cd "$BACKEND_DIR"
  exec "$BACKEND_PYTHON" app.py
) &
BACKEND_PID=$!
PIDS+=("$BACKEND_PID")

# Start the frontend dev server
echo "Starting frontend with: npm run dev"
(
  cd "$FRONTEND_DIR"
  exec npm run dev
) &
FRONTEND_PID=$!
PIDS+=("$FRONTEND_PID")

echo
echo "Tactix services are starting..."
echo "- Backend:  http://localhost:5001"
echo "- Frontend: http://localhost:3000"
echo
echo "Press Ctrl+C to stop both services."

# Block until either service exits
set +e
wait_for_first_exit
EXIT_STATUS=$?
set -e

echo
echo "One of the services stopped. Shutting down the rest..."
cleanup "$EXIT_STATUS"
