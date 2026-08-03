# 🧪 API Load Testing with k6

This repository contains a **parameterized `loadtest.js`** script for load testing any HTTP API endpoint using [k6](https://k6.io).

The script is designed to simulate up to **hundreds of thousands of requests** (e.g., 500,000) with configurable concurrency, authentication, and request payloads — all via environment variables.

---

## ⚙️ Installation

Install **k6**:

```
# macOS
brew install k6
```

```
# Ubuntu / Debian
sudo apt install k6
```
```
# Windows (Chocolatey)
choco install k6
```

Verify installation:
```
k6 version
```

⸻

🚀 Usage

All configuration is done through environment variables, so you never need to edit the script.

🧩 Default Run
```
k6 run loadtest.js
```

This will hit the default endpoint:
```
https://api.staging.invoiced.com/events
```

⸻

🌐 Test a Different Endpoint

```
ENDPOINT="https://api.staging.invoiced.com/v2/customers" k6 run loadtest.js
```

⸻

📬 POST Example with JSON Payload
```
ENDPOINT="https://api.staging.invoiced.com/v2/events" \
METHOD=POST \
BODY_JSON='{"type":"event_created","limit":50}' \
k6 run loadtest.js
```
⸻

🔐 With Bearer Token Authentication
```
ENDPOINT="https://api.staging.invoiced.com/events" \
BEARER_TOKEN="your_api_token_here" \
k6 run loadtest.js
```
⸻

🧾 With Basic Authentication (Single Key)
```
ENDPOINT="https://api.staging.invoiced.com/events" \
BASIC_USER="your_api_key" \
BASIC_PASS="" \
k6 run loadtest.js
```
⸻

🔑 Multiple API Keys

Supply multiple API keys as a comma-separated list via `API_KEYS`. VUs are distributed evenly across keys — each key gets approximately `VUS / number_of_keys` concurrent users (e.g., 60 VUs with 3 keys = 20 VUs per key). This helps stay within per-key rate limits while maximizing total throughput.

```
k6 run -e API_KEYS="key1,key2,key3" \
       -e VUS=60 \
       -e TOTAL_ITERATIONS=100000 \
       tests/loadtest.js
```

⸻

🔀 Multiple Endpoints

Target multiple endpoints by passing a comma-separated list via `ENDPOINTS`. Requests rotate across all endpoints to stress different DB tables and code paths simultaneously.

```
k6 run -e API_KEYS="key1,key2,key3" \
       -e ENDPOINTS="/customers,/invoices,/events,/credit_notes,/subscriptions,/payments,/estimates" \
       -e VUS=60 \
       -e TOTAL_ITERATIONS=100000 \
       tests/loadtest.js
```

If `ENDPOINTS` is not set, the script defaults to: `/customers`, `/invoices`, `/events`, `/credit_notes`, `/subscriptions`, `/payments`, `/estimates`.

⸻

⚙️ Adjust Concurrency & Total Requests
```
ENDPOINT="https://api.staging.invoiced.com/events" \
TOTAL_ITERATIONS=250000 \
VUS=100 \
k6 run loadtest.js
```

⸻

🧠 Example with Query Parameters and Timeout
```
ENDPOINT="https://api.staging.invoiced.com/events" \
QUERY="since=2025-01-01&limit=100" \
TIMEOUT_MS=90000 \
k6 run loadtest.js
```
⸻

📊 Output and Reports

During execution, k6 prints live metrics in the console, including:
	•	Success rate
	•	Average and percentile latency (P95, P99)
	•	Error rate
	•	Throughput (requests/sec)

After the run, three output files are generated:
- `tests/summary.json` — raw JSON metrics
- `tests/report.html` — interactive HTML report (open in any browser)

To customize the HTML report filename:
```
k6 run -e REPORT_FILE="tests/my-run-2026-08-03.html" tests/loadtest.js
```

You can also output to JSON or cloud dashboards:
```
k6 run --out json=results.json tests/loadtest.js
```
Or, if using Grafana Cloud:
```
k6 cloud tests/loadtest.js
```
⸻

💡 Environment Variables Reference

| Variable         | Description                                          | Default Value                                                                       |
|------------------|------------------------------------------------------|-------------------------------------------------------------------------------------|
| ENDPOINT         | Single URL to test (legacy, use ENDPOINTS instead)   | https://api.staging.invoiced.com/events                                             |
| ENDPOINTS        | Comma-separated endpoint paths to rotate across      | /customers,/invoices,/events,/credit_notes,/subscriptions,/payments,/estimates       |
| BASE_URL         | Base URL prepended to ENDPOINTS paths                | https://api.invoiced-backend-staging.invoiced.com                                   |
| METHOD           | HTTP method (GET, POST, etc.)                        | GET                                                                                 |
| QUERY            | URL query string appended to every request           | per_page=100&sort=created_at                                                        |
| BODY_JSON        | JSON body for POST/PUT/PATCH                         | (empty)                                                                             |
| API_KEYS         | Comma-separated API keys (VUs distributed evenly)    | (none)                                                                              |
| BEARER_TOKEN     | Bearer token for Authorization header                | (none)                                                                              |
| BASIC_USER       | Basic auth username (single key fallback)            | (none)                                                                              |
| BASIC_PASS       | Basic auth password                                  | (none)                                                                              |
| TOTAL_ITERATIONS | Total number of requests to run                      | 500000                                                                              |
| VUS              | Virtual users (concurrency)                          | 200                                                                                 |
| SLEEP            | Pause (seconds) between iterations                   | 0                                                                                   |
| TIMEOUT_MS       | Request timeout in ms                                | 60000                                                                               |
| REPORT_FILE      | Output path for the HTML report                      | tests/report.html                                                                   |
| MAX_DURATION     | Safety ceiling for test duration                     | 2h                                                                                  |


⸻

🧯 Safety Tips

	•	Only test non-production environments unless explicitly approved.
	•	Start small (e.g., 1,000 requests) before ramping up to 500,000.
	•	Monitor server CPU, memory, and rate limits.
	•	Use metrics dashboards (Grafana, Datadog, etc.) to observe performance.

⸻

🏁 Example Full Run (Typical)
```
k6 run -e API_KEYS="key1,key2,key3" \
       -e ENDPOINTS="/customers,/invoices,/events,/credit_notes,/subscriptions,/payments,/estimates" \
       -e QUERY="per_page=200&sort=created_at&expand=customer" \
       -e VUS=60 \
       -e TOTAL_ITERATIONS=100000 \
       tests/loadtest.js
```

This distributes 60 VUs across 3 API keys (20 VUs per key), rotates through 7 endpoints with a heavy query, and runs 100k total iterations.



