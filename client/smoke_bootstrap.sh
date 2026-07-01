#!/usr/bin/env bash
#
# 災鏈 ResQLink smoke test: bootstrap, artifacts, review approve/reject.
#
# Usage:   bash client/smoke_bootstrap.sh
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

pretty() { if [ "${HAVE_JQ}" -eq 1 ]; then jq .; else cat; fi; }

# Body goes via a temp file + --data-binary: Windows curl.exe re-encodes non-ASCII argv and corrupts UTF-8.
post_json() {
  local url="$1" body="$2" tmp
  tmp="$(mktemp)"
  printf '%s' "${body}" > "${tmp}"
  curl -sS -X POST "${url}" -H "Content-Type: application/json" \
    --data-binary @"${tmp}"
  rm -f "${tmp}"
}

extract_field() {
  sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n1
}

# Match standalone "id" only; *_id fields are preceded by an underscore.
extract_ids() {
  grep -oE '"id":"[0-9a-fA-F-]{36}"' | grep -oE '[0-9a-fA-F-]{36}'
}

echo "============================================"
echo " 1. Health check"
echo "============================================"
curl -sS "${BASE_URL}/v1/health" | pretty
echo

echo "============================================"
echo " 2. Create incident"
echo "============================================"
CREATE_RESP="$(curl -sS -X POST "${BASE_URL}/v1/events/alerts" \
  -H "Content-Type: application/json" --data-binary @"${SAMPLE}")"
echo "${CREATE_RESP}" | pretty
INCIDENT_ID="$(printf '%s' "${CREATE_RESP}" | extract_field "incident_id")"
echo
echo "[info] incident_id = ${INCIDENT_ID}"
echo

echo "============================================"
echo " 3. Bootstrap incident (POST /v1/bootstrap/incidents/{id})"
echo "============================================"
curl -sS -X POST "${BASE_URL}/v1/bootstrap/incidents/${INCIDENT_ID}" | pretty
echo

echo "============================================"
echo " 4. List artifacts for this incident"
echo "============================================"
curl -sS "${BASE_URL}/v1/artifacts?incident_id=${INCIDENT_ID}" | pretty
echo

echo "============================================"
echo " 5. Get first artifact detail"
echo "============================================"
ARTIFACT_ID="$(curl -sS "${BASE_URL}/v1/artifacts?incident_id=${INCIDENT_ID}" \
  | extract_ids | sed -n '1p')"
echo "[info] first artifact_id = ${ARTIFACT_ID}"
if [ -n "${ARTIFACT_ID}" ]; then
  curl -sS "${BASE_URL}/v1/artifacts/${ARTIFACT_ID}" | pretty
fi
echo

echo "============================================"
echo " 6. List review tasks for this incident"
echo "============================================"
REVIEWS_RESP="$(curl -sS "${BASE_URL}/v1/reviews?incident_id=${INCIDENT_ID}")"
echo "${REVIEWS_RESP}" | pretty
mapfile -t REVIEW_IDS < <(printf '%s' "${REVIEWS_RESP}" | extract_ids)
echo
echo "[info] review task count = ${#REVIEW_IDS[@]}"
FIRST_REVIEW="${REVIEW_IDS[0]:-}"
SECOND_REVIEW="${REVIEW_IDS[1]:-}"
echo "[info] first review  = ${FIRST_REVIEW}"
echo "[info] second review = ${SECOND_REVIEW}"
echo

echo "============================================"
echo " 7. Approve the first review task"
echo "============================================"
if [ -n "${FIRST_REVIEW}" ]; then
  post_json "${BASE_URL}/v1/reviews/${FIRST_REVIEW}/approve" \
    '{"note":"內容確認可公開"}' | pretty
fi
echo

echo "============================================"
echo " 8. List artifacts — confirm first artifact is approved"
echo "============================================"
curl -sS "${BASE_URL}/v1/artifacts?incident_id=${INCIDENT_ID}" | pretty
echo

echo "============================================"
echo " 9. Reject the second review task"
echo "============================================"
if [ -n "${SECOND_REVIEW}" ]; then
  post_json "${BASE_URL}/v1/reviews/${SECOND_REVIEW}/reject" \
    '{"note":"內容需要補充官方來源"}' | pretty
fi
echo

echo "============================================"
echo " 10. List outbox events"
echo "     (incident.created / incident.bootstrapped /"
echo "      artifact.approved / artifact.rejected)"
echo "============================================"
curl -sS "${BASE_URL}/v1/events/outbox?limit=20" | pretty
echo

echo "[done] smoke test complete."
