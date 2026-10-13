#!/usr/bin/env bash
# Example: start Sitemap URL Extractor via Apify REST API
# Actor: https://apify.com/chris_elder/sitemap-url-extractor
# Requires: curl, jq, APIFY_TOKEN
set -euo pipefail
: "${APIFY_TOKEN:?Set APIFY_TOKEN}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INPUT="$(cat "$SCRIPT_DIR/input.example.json")"

# Resolve actor ID then start a run
ACTOR_ID="chris_elder~sitemap-url-extractor"
RUN=$(curl -sS -X POST   -H "Authorization: Bearer $APIFY_TOKEN"   -H "Content-Type: application/json"   "https://api.apify.com/v2/acts/$ACTOR_ID/runs?waitForFinish=120"   -d "$INPUT")

echo "$RUN" | jq '{id: .data.id, status: .data.status, datasetId: .data.defaultDatasetId}'
DATASET_ID=$(echo "$RUN" | jq -r '.data.defaultDatasetId')
curl -sS -H "Authorization: Bearer $APIFY_TOKEN"   "https://api.apify.com/v2/datasets/$DATASET_ID/items?format=json&clean=1&limit=5" | jq .
