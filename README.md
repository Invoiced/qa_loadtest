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
https://api.staging.invoiced.com/list_events
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
ENDPOINT="https://api.staging.invoiced.com/list_events" \
BEARER_TOKEN="your_api_token_here" \
k6 run loadtest.js
```
⸻

🧾 With Basic Authentication
```
ENDPOINT="https://api.staging.invoiced.com/list_events" \
BASIC_USER="your_api_key" \
BASIC_PASS="" \
k6 run loadtest.js
```
⸻

⚙️ Adjust Concurrency & Total Requests
```
ENDPOINT="https://api.staging.invoiced.com/list_events" \
TOTAL_ITERATIONS=250000 \
VUS=100 \
k6 run loadtest.js
```

⸻

🧠 Example with Query Parameters and Timeout
```
ENDPOINT="https://api.staging.invoiced.com/list_events" \
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

After the run, a summary file summary.json is written to disk.

You can also output to JSON or cloud dashboards:
```
k6 run --out json=results.json loadtest.js
```
Or, if using Grafana Cloud:
```
k6 cloud loadtest.js
```
⸻

💡 Environment Variables Reference

| Variable         | Description                           | Default Value                                |
|------------------|---------------------------------------|----------------------------------------------|
| ENDPOINT         | URL to test                           | https://api.staging.invoiced.com/list_events |
| METHOD           | HTTP method (GET, POST, etc.)         | GET                                          |
| QUERY            | URL query string                      | (empty)                                      |
| BODY_JSON        | JSON body for POST/PUT/PATCH          | (empty)                                      |
| BEARER_TOKEN     | Bearer token for Authorization header | (none)                                       |
| BASIC_USER       | Basic auth username                   | (none)                                       |
| BASIC_PASS       | Basic auth password                   | (none)                                       |
| TOTAL_ITERATIONS | Total number of requests to run       | 500000                                       |
| VUS              | Virtual users (concurrency)           | 200                                          |
| SLEEP            | Pause (seconds) between iterations    | 0                                            |
| TIMEOUT_MS       | Request timeout in ms                 | 60000                                        |
| MAX_DURATION     | Safety ceiling for test duration      | 2h                                           |


⸻

🧯 Safety Tips

	•	Only test non-production environments unless explicitly approved.
	•	Start small (e.g., 1,000 requests) before ramping up to 500,000.
	•	Monitor server CPU, memory, and rate limits.
	•	Use metrics dashboards (Grafana, Datadog, etc.) to observe performance.

⸻

🏁 Example Full Run (Typical)
```
ENDPOINT="https://api.staging.invoiced.com/list_events" \
BEARER_TOKEN="your_token_here" \
TOTAL_ITERATIONS=500000 \
VUS=200 \
k6 run loadtest.js
```



