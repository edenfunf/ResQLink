#!/usr/bin/env bash
#
# 災鏈 ResQLink smoke test: health, create/list/get incident, outbox.
#
# Usage:   bash client/smoke_incidents.sh
# Env:     BASE_URL (default http://localhost:8000). jq optional.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAMPLE="${SCRIPT_DIR}/../samples/alert-event-mataian.json"

if command -v jq >/dev/null 2>&1; then
  HAVE_JQ=1
else
  HAVE_JQ=0
  echo "[info] jq not found — printing raw JSON. Install jq for pretty output." >&2
fi

pretty() {
  if [ "${HAVE_JQ}" -eq 1 ]; then
    jq .
  else
    cat
  fi
}

extract_field() {
  sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n1
}

echo "============================================"
echo " 1. Health check"
echo "============================================"
curl -sS "${BASE_URL}/v1/health" | pretty
echo

echo "============================================"
echo " 2. Create incident (POST /v1/events/alerts)"
echo "============================================"
CREATE_RESP="$(curl -sS -X POST "${BASE_URL}/v1/events/alerts" \
  -H "Content-Type: application/json" \
  --data-binary @"${SAMPLE}")"
echo "${CREATE_RESP}" | pretty

INCIDENT_ID="$(printf '%s' "${CREATE_RESP}" | extract_field "incident_id")"
echo
echo "[info] incident_id = ${INCIDENT_ID}"
echo

echo "============================================"
echo " 3. List incidents (GET /v1/incidents)"
echo "============================================"
curl -sS "${BASE_URL}/v1/incidents?limit=20&offset=0" | pretty
echo

echo "============================================"
echo " 4. Get incident detail (GET /v1/incidents/{id})"
echo "============================================"
if [ -n "${INCIDENT_ID}" ]; then
  curl -sS "${BASE_URL}/v1/incidents/${INCIDENT_ID}" | pretty
else
  echo "[warn] could not parse incident_id; skipping detail call." >&2
fi
echo

echo "============================================"
echo " 5. List outbox events (GET /v1/events/outbox)"
echo "============================================"
curl -sS "${BASE_URL}/v1/events/outbox?limit=20" | pretty
echo

echo "[done] smoke test complete."
