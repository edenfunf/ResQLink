#!/usr/bin/env bash
#
# 災鏈 ResQLink smoke test: reports, geojson, public preview.
# Non-ASCII bodies go via --data-binary from a file: Windows curl.exe re-encodes non-ASCII argv.
#
# Usage:   bash client/smoke_reports.sh
# Env:     BASE_URL (default http://localhost:8000). jq optional.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAMPLES="${SCRIPT_DIR}/../samples"

if command -v jq >/dev/null 2>&1; then HAVE_JQ=1; else HAVE_JQ=0;
  echo "[info] jq not found — printing raw JSON. Install jq for pretty output." >&2
fi
pretty() { if [ "${HAVE_JQ}" -eq 1 ]; then jq .; else cat; fi; }

extract_field() {
  sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n1
}
extract_ids() {
  grep -oE '"id":"[0-9a-fA-F-]{36}"' | grep -oE '[0-9a-fA-F-]{36}'
}

# Percent-encode UTF-8 bytes so a non-ASCII slug is safe in the URL path (LC_ALL=C = byte-wise).
urlencode() {
  local LC_ALL=C s="$1" i c out=""
  for (( i=0; i<${#s}; i++ )); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *) out+="$(printf '%%%02X' "'$c")" ;;
    esac
  done
  printf '%s' "$out"
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
  -H "Content-Type: application/json" \
  --data-binary @"${SAMPLES}/alert-event-mataian.json")"
echo "${CREATE_RESP}" | pretty
INCIDENT_ID="$(printf '%s' "${CREATE_RESP}" | extract_field "incident_id")"
SLUG="$(printf '%s' "${CREATE_RESP}" | extract_field "slug")"
echo
echo "[info] incident_id = ${INCIDENT_ID}"
echo "[info] slug        = ${SLUG}"
echo

echo "============================================"
echo " 3. Bootstrap incident"
echo "============================================"
curl -sS -X POST "${BASE_URL}/v1/bootstrap/incidents/${INCIDENT_ID}" >/dev/null
echo "[info] bootstrap done (6 artifacts + 6 review tasks)"
echo

echo "============================================"
echo " 4. List reviews"
echo "============================================"
REVIEWS_RESP="$(curl -sS "${BASE_URL}/v1/reviews?incident_id=${INCIDENT_ID}")"
echo "${REVIEWS_RESP}" | pretty
mapfile -t REVIEW_IDS < <(printf '%s' "${REVIEWS_RESP}" | extract_ids)
echo
echo "[info] review task count = ${#REVIEW_IDS[@]}"
echo

echo "============================================"
echo " 5. Approve the first two review tasks"
echo "============================================"
for RID in "${REVIEW_IDS[0]:-}" "${REVIEW_IDS[1]:-}"; do
  [ -z "${RID}" ] && continue
  echo "-> approve ${RID}"
  curl -sS -X POST "${BASE_URL}/v1/reviews/${RID}/approve" | pretty
  echo
done
echo

echo "============================================"
echo " 6. Submit damage-report.json (with coordinates)"
echo "============================================"
curl -sS -X POST "${BASE_URL}/v1/incidents/${INCIDENT_ID}/reports" \
  -H "Content-Type: application/json" \
  --data-binary @"${SAMPLES}/damage-report.json" | pretty
echo

echo "============================================"
echo " 7. Submit damage-report-no-location.json (no coordinates)"
echo "============================================"
curl -sS -X POST "${BASE_URL}/v1/incidents/${INCIDENT_ID}/reports" \
  -H "Content-Type: application/json" \
  --data-binary @"${SAMPLES}/damage-report-no-location.json" | pretty
echo

echo "============================================"
echo " 8. List reports (no reporter_contact in list)"
echo "============================================"
REPORTS_RESP="$(curl -sS "${BASE_URL}/v1/incidents/${INCIDENT_ID}/reports")"
echo "${REPORTS_RESP}" | pretty
REPORT_ID="$(printf '%s' "${REPORTS_RESP}" | extract_ids | sed -n '1p')"
echo
echo "[info] first report_id = ${REPORT_ID}"
echo

echo "============================================"
echo " 9. Get report detail"
echo "============================================"
if [ -n "${REPORT_ID}" ]; then
  curl -sS "${BASE_URL}/v1/reports/${REPORT_ID}" | pretty
fi
echo

echo "============================================"
echo " 10. Reports GeoJSON (only reports WITH coordinates)"
echo "============================================"
curl -sS "${BASE_URL}/v1/incidents/${INCIDENT_ID}/reports.geojson" | pretty
echo
echo "[info] Expect exactly 1 feature (the no-location report is excluded),"
echo "[info] and NO reporter_name / reporter_contact in properties."
echo

echo "============================================"
echo " 11. Public preview (APPROVED artifacts only)"
echo "============================================"
SLUG_ENC="$(urlencode "${SLUG}")"
echo "[info] slug (url-encoded) = ${SLUG_ENC}"
curl -sS "${BASE_URL}/v1/public/preview/${SLUG_ENC}" | pretty
echo
echo "[info] Expect only the 2 approved artifacts (no pending_review / rejected)."
echo

echo "============================================"
echo " 12. Outbox events (look for disaster_report.created)"
echo "============================================"
curl -sS "${BASE_URL}/v1/events/outbox?limit=10" | pretty
echo

echo "[done] smoke test complete."
