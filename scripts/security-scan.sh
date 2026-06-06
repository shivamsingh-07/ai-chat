#!/bin/bash

set -e

IMAGE="${1:-abstergo07/ai-chat:latest}"
SCAN_OUTPUT="$(mktemp)"
trap 'rm -f "$SCAN_OUTPUT"' EXIT

if trivy image "$IMAGE" \
	--scanners vuln \
	--severity HIGH,CRITICAL \
	--exit-code 1 \
	--format table \
	--table-mode detailed \
	--output "$SCAN_OUTPUT"; then
	VERDICT="PASS"
else
	VERDICT="FAIL"
fi

{
	echo "======================================================================"
	echo "Trivy Vulnerability Scan"
	echo "Image: $IMAGE"
	echo "Date:  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
	echo "======================================================================"
	if [ -s "$SCAN_OUTPUT" ]; then
		cat "$SCAN_OUTPUT"
	else
		echo
		echo "No vulnerabilities found."
		echo
	fi
	echo "======================================================================"
	echo "VERDICT: $VERDICT"
	echo "======================================================================"
} | tee trivy-report.log
