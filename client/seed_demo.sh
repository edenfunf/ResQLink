#!/usr/bin/env bash
#
# DisasterBlock — one-click demo data seeder.
#
# Usage:   bash client/seed_demo.sh
# Env:     API_BASE_URL (default http://localhost:8000)
#          WEB_BASE_URL (default http://localhost:3000)

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"
WEB_BASE_URL="${WEB_BASE_URL:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAMPLES="${SCRIPT_DIR}/../samples"

if command -v jq >/dev/null 2>&1; then HAVE_JQ=1; else HAVE_JQ=0; fi
PY=""
if command -v python3 >/dev/null 2>&1; then PY="python3";
elif command -v python >/dev/null 2>&1; then PY="python"; fi

# Pull a top-level string field out of JSON without a parser.
grep_field() {
  sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n1
}

pyget() {
  "$PY" -c "import sys,json
d=json.load(sys.stdin)
print($1)"
}

post_file() {
  # --data-binary from a file: Windows curl.exe re-encodes non-ASCII argv and corrupts UTF-8.
  curl -sS -X POST "$1" -H "Content-Type: application/json" --data-binary @"$2"
}

echo "==> 1. Health check (${API_BASE_URL})"
curl -sS "${API_BASE_URL}/v1/health" >/dev/null && echo "    API OK"

echo "==> 2. Create incident"
CREATE_RESP="$(post_file "${API_BASE_URL}/v1/events/alerts" "${SAMPLES}/alert-event-mataian.json")"
INCIDENT_ID="$(printf '%s' "${CREATE_RESP}" | grep_field incident_id)"
SLUG="$(printf '%s' "${CREATE_RESP}" | grep_field slug)"
echo "    incident_id = ${INCIDENT_ID}"
echo "    slug        = ${SLUG}"

echo "==> 3. Bootstrap incident"
curl -sS -X POST "${API_BASE_URL}/v1/bootstrap/incidents/${INCIDENT_ID}" >/dev/null
echo "    6 artifacts + 6 review tasks generated"

echo "==> 4-6. Approve microsite_config / public_notice_draft / map_bundle"
REVIEWS_JSON="$(curl -sS "${API_BASE_URL}/v1/reviews?incident_id=${INCIDENT_ID}&limit=50")"
TARGET_TYPES=" microsite_config public_notice_draft map_bundle "

approve_review() {
  curl -sS -X POST "${API_BASE_URL}/v1/reviews/$1/approve" >/dev/null && echo "    approved review $1 ($2)"
}

emit_pairs() {
  if [ "${HAVE_JQ}" = 1 ]; then
    printf '%s' "${REVIEWS_JSON}" | jq -r '.items[] | "\(.id) \(.artifact_id)"'
  elif [ -n "${PY}" ]; then
    printf '%s' "${REVIEWS_JSON}" | "$PY" -c "import sys,json
for r in json.load(sys.stdin)['items']:
    print(r['id'], r['artifact_id'])"
  else
    printf '%s' "${REVIEWS_JSON}" \
      | grep -oE '"id":"[0-9a-fA-F-]{36}","incident_id":"[0-9a-fA-F-]{36}","artifact_id":"[0-9a-fA-F-]{36}"' \
      | sed -E 's/"id":"([0-9a-fA-F-]{36})".*"artifact_id":"([0-9a-fA-F-]{36})"/\1 \2/'
  fi
}

# tr -d '\r': a CRLF from Windows Python/curl would corrupt the artifact URL.
while read -r RID AID; do
  RID="${RID//$'\r'/}"; AID="${AID//$'\r'/}"
  [ -z "${RID}" ] && continue
  TYPE="$(curl -sS "${API_BASE_URL}/v1/artifacts/${AID}" | grep_field artifact_type | tr -d '\r')"
  case "${TARGET_TYPES}" in
    *" ${TYPE} "*) approve_review "${RID}" "${TYPE}" ;;
  esac
done <<EOF
$(emit_pairs | tr -d '\r')
EOF

echo "==> 7. Submit damage report (with coordinates)"
post_file "${API_BASE_URL}/v1/incidents/${INCIDENT_ID}/reports" "${SAMPLES}/damage-report.json" >/dev/null
echo "    submitted (geolocated)"

echo "==> 8. Submit damage report (no coordinates)"
post_file "${API_BASE_URL}/v1/incidents/${INCIDENT_ID}/reports" "${SAMPLES}/damage-report-no-location.json" >/dev/null
echo "    submitted (no location)"

echo "==> 9. Situation summary (read-model aggregation)"
SUMMARY_JSON="$(curl -sS "${API_BASE_URL}/v1/incidents/${INCIDENT_ID}/summary")"
if [ "${HAVE_JQ}" = 1 ]; then
  printf '%s' "${SUMMARY_JSON}" | jq -r '
    "    artifacts: \(.artifacts.approved)/\(.artifacts.total) approved | reviews pending \(.reviews.pending)",
    "    reports: \(.reports.total) total, \(.reports.geolocated) on map",
    "    needs: " + ([.reports.by_need_type[] | "\(.key)×\(.count)"] | join(", "))'
elif [ -n "${PY}" ]; then
  printf '%s' "${SUMMARY_JSON}" | "$PY" -c "import sys,json
d=json.load(sys.stdin)
a,r,rep=d['artifacts'],d['reviews'],d['reports']
print('    artifacts: %d/%d approved | reviews pending %d' % (a['approved'],a['total'],r['pending']))
print('    reports: %d total, %d on map' % (rep['total'],rep['geolocated']))
print('    needs: ' + ', '.join('%sx%d'%(c['key'],c['count']) for c in rep['by_need_type']))" | tr -d '\r'
else
  echo "    (summary at GET /v1/incidents/${INCIDENT_ID}/summary)"
fi

cat <<EOF

============================================================
 Demo data created.

 Console:
 ${WEB_BASE_URL}/console

 Incident:
 ${WEB_BASE_URL}/incidents/${INCIDENT_ID}

 Public Preview:
 ${WEB_BASE_URL}/preview/${SLUG}

 Report Form:
 ${WEB_BASE_URL}/reports/${INCIDENT_ID}

 GeoJSON:
 ${API_BASE_URL}/v1/incidents/${INCIDENT_ID}/reports.geojson

 Situation Summary (API):
 ${API_BASE_URL}/v1/incidents/${INCIDENT_ID}/summary
============================================================
EOF
