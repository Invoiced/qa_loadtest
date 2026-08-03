# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Overview

This is a parameterized **k6 load testing framework** for HTTP APIs, targeting the Invoiced platform (primarily `https://api.staging.invoiced.com`). All test behavior is controlled via environment variables — no code changes are needed to target different endpoints or configure load profiles.

## Project Structure

```
qa_loadtest/
├── tests/
│   ├── loadtest.js   # Main k6 test script
│   └── summary.json  # Output from the last test run
├── index.js          # Minimal entry point (not the test runner)
├── package.json      # Node project metadata (no npm deps to install)
└── README.md         # Installation and usage documentation
```

## Prerequisites

k6 must be installed separately — it is **not** an npm dependency. The test runner is the k6 CLI, not Node.js.

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo apt install k6
```

## Running Load Tests

```bash
# Basic run with all defaults (500k iterations, 200 VUs, GET /list_events on staging)
k6 run tests/loadtest.js

# Target a specific endpoint
k6 run -e ENDPOINT=https://api.staging.invoiced.com/customers tests/loadtest.js

# POST with JSON body and Bearer auth
k6 run -e METHOD=POST \
       -e ENDPOINT=https://api.staging.invoiced.com/invoices \
       -e BODY_JSON='{"customer":123}' \
       -e BEARER_TOKEN=<token> \
       tests/loadtest.js

# Basic auth
k6 run -e BASIC_USER=<api_key> -e BASIC_PASS="" tests/loadtest.js

# Adjust concurrency and total load
k6 run -e VUS=50 -e TOTAL_ITERATIONS=10000 tests/loadtest.js

# Export results to JSON
k6 run --out json=results.json tests/loadtest.js
```

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `ENDPOINT` | `https://api.staging.invoiced.com/list_events` | URL to test |
| `METHOD` | `GET` | HTTP method (GET, POST, PUT, DELETE) |
| `QUERY` | *(empty)* | URL query string (e.g., `page=1&per_page=10`) |
| `BODY_JSON` | *(empty)* | JSON body for POST/PUT/PATCH |
| `BEARER_TOKEN` | *(empty)* | Bearer token auth (takes priority over Basic) |
| `BASIC_USER` | *(empty)* | Basic auth username (API key) |
| `BASIC_PASS` | *(empty)* | Basic auth password (usually empty for Invoiced API) |
| `TOTAL_ITERATIONS` | `500000` | Total requests across all VUs |
| `VUS` | `200` | Concurrent virtual users |
| `SLEEP` | `0` | Seconds to pause between iterations per VU |
| `TIMEOUT_MS` | `60000` | Request timeout in milliseconds |
| `MAX_DURATION` | `2h` | Hard wall-clock cap on the test run |

## Thresholds

The script defines two pass/fail thresholds:

- **Error rate** — `http_req_failed < 1%` (HTTP errors must stay under 1%)
- **Latency** — `http_req_duration p(95) < 500ms` (95th percentile must be under 500ms)

k6 will exit with a non-zero code if either threshold is breached.

## Architecture Notes

- **`tests/loadtest.js`** is the single test file. It exports a `default` function (executed per iteration) and a `handleSummary` function (writes `tests/summary.json` after the run).
- Auth is resolved in `buildHeaders()`: Bearer token takes priority; falls back to Basic auth if `BASIC_USER` is set.
- The executor is `shared-iterations`, meaning k6 distributes `TOTAL_ITERATIONS` across all VUs and the test ends when the total is exhausted or `MAX_DURATION` is reached.

## Safety Guidelines

- Always test against **staging** (`app.staging.invoiced.com` / `api.staging.invoiced.com`), never production.
- Start with low VUs (`VUS=10`) and short runs (`TOTAL_ITERATIONS=100`) to verify the target endpoint and auth before scaling up.
- Monitor staging server CPU/memory during high-VU runs — 200 VUs at zero sleep can be aggressive.
