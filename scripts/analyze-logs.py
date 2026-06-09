#!/usr/bin/env python3
"""Send a failed build log to Gemini for review.

Always prints JSON: {"cause", "fix"} on success, or {"error"} on failure.

Usage:
  analyze-logs.py --api-key <GEMINI_API_KEY> --log <path/to/log>

Exit code is 0 on a successful analysis, non-zero on error.
"""

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request

GEMINI_MODELS = [
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
]
MAX_LOG_CHARS = 6000
MAX_RETRIES = 5
INITIAL_BACKOFF_S = 2
REQUEST_TIMEOUT_S = 60
RETRYABLE_STATUS = {429, 500, 502, 503, 504}


def build_prompt(logs: str) -> str:
    return f"""
You are a senior CI/CD engineer reviewing a failed Jenkins pipeline build.

Your tasks:
1. Determine the reason the build failed.
2. Provide a probable fix if one can be reasonably inferred from the logs.

Respond ONLY in valid JSON with this exact schema:
{{
  "cause": "",
  "fix": ""
}}

If no fix can be inferred, set "fix" to "No fix could be inferred from the logs".

Build logs:
{logs}
"""


def request_model(model: str, api_key: str, payload: dict) -> dict:
    """One model, with up to MAX_RETRIES backoff retries on transient errors."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    backoff = INITIAL_BACKOFF_S
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code not in RETRYABLE_STATUS or attempt == MAX_RETRIES:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == MAX_RETRIES:
                raise
        time.sleep(backoff)
        backoff *= 2


def call_gemini(api_key: str, prompt: str) -> dict:
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    raw = None
    last_error = None
    for model in GEMINI_MODELS:
        try:
            raw = request_model(model, api_key, payload)
            break
        except (urllib.error.URLError, TimeoutError) as e:
            last_error = e

    if raw is None:
        raise last_error or RuntimeError("All Gemini models failed")

    text = raw["candidates"][0]["content"]["parts"][0]["text"]

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

    return {
        "cause": "LLM returned invalid JSON",
        "fix": "Inspect raw model output and tighten the prompt constraints",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="AI review of a failed build log.")
    parser.add_argument("--api-key", required=True, help="Gemini API key.")
    parser.add_argument("--log", required=True, help="Path to the build log artifact to review.")
    args = parser.parse_args()

    try:
        with open(args.log, encoding="utf-8", errors="replace") as f:
            logs = f.read()
    except OSError as e:
        print(json.dumps({"error": f"cannot read log file '{args.log}': {e}"}, indent=2))
        return 2

    if not logs.strip():
        print(json.dumps({"error": f"log file '{args.log}' is empty"}, indent=2))
        return 2

    logs = logs[-MAX_LOG_CHARS:]

    try:
        analysis = call_gemini(args.api_key, build_prompt(logs))
    except Exception as e:
        print(json.dumps({"error": f"AI analysis failed: {e}"}, indent=2))
        return 1

    print(json.dumps(analysis, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
