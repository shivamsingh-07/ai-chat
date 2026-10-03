#!/bin/bash

set -euo pipefail

BASE_URL="${1:-http://localhost:5000}"
WORKERS=5
DURATION=120

create_session() {
    curl -sfk -X POST "${BASE_URL}/api/sessions" |
        python3 -c 'import json,sys; print(json.load(sys.stdin)["sessionId"])'
}

send_chat() {
    local session_id=$1
    local label=$2
    curl -sfk -o /dev/null \
        -X POST "${BASE_URL}/api/sessions/${session_id}/chat" \
        -H "Content-Type: application/json" \
        -d "{\"message\":\"Load test ${label}: explain neural networks in detail.\"}" \
        --max-time 180
}

worker() {
    local id=$1
    local end=$((SECONDS + DURATION))
    local session_id
    local n=0

    session_id=$(create_session)

    while [[ $SECONDS -lt $end ]]; do
        n=$((n + 1))
        send_chat "$session_id" "${id}-${n}" &
        wait
    done
}

if ! curl -sfk "${BASE_URL}/health/ready" >/dev/null; then
    echo "Service not ready at ${BASE_URL}/health/ready" >&2
    echo "Usage: $0 [base_url]" >&2
    exit 1
fi

echo "Generating load against ${BASE_URL} for ${DURATION}s..."

for ((i = 1; i <= WORKERS; i++)); do
    worker "$i" &
done

wait
echo "Done."
