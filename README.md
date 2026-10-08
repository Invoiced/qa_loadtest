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

**Storing keys in a `.env` file:** copy `.env.example` to `.env` (gitignored) and put all keys on the single `API_KEYS=` line. k6 does not read `.env` itself, so load it into your shell and pass the value through:

```
cp .env.example .env      # then edit .env
set -a; source .env; set +a
k6 run -e API_KEYS="$API_KEYS" -e BASE_URL="$BASE_URL" tests/loadtest.js
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

📈 Step Scaling Test (InvoicedResqueWorker Autoscaling)

Validates the staging autoscaling policy for the `InvoicedResqueWorker` ECS service. The policy is saved in `config/autoscaling-policy.json` (reference only — the script does not read it). Background and open questions are in `docs/step-scaling-test-plan.md`.

**How the policy works**

The metric is **Backlog Per Worker** = `QueueDepth` (Resque, queue `normal`, Maximum) ÷ running worker count (`SampleCount` of ECS `CPUUtilization`), evaluated over 60s periods with a 60s cooldown.

| Backlog per worker | Action | Type |
|---|---|---|
| ≤ 100 | remove 1 worker | ChangeInCapacity (scale in) |
| 100 – 200 | set to **2** workers | ExactCapacity |
| 200 – 500 | set to **5** workers | ExactCapacity |
| 500 – 1,000 | set to **10** workers | ExactCapacity |
| 1,000 – 2,000 | set to **20** workers | ExactCapacity |
| 2,000 – 3,000 | set to **30** workers | ExactCapacity |
| 3,000 – 4,000 | set to **40** workers | ExactCapacity |
| > 4,000 | set to **50** workers | ExactCapacity |

The `metric_interval_*` bounds in the policy are offsets from the threshold (100), so the bands above are the absolute backlog-per-worker values. Scale-out values are the *total* worker count, not an increment.

**Running it**

`PROFILE=steps` switches from the default fixed-iteration run to a `ramping-arrival-rate` staircase. `STAGES` is a list of `rate:duration` pairs, where rate is requests/sec.

```
k6 run -e PROFILE=steps \
       -e STAGES="5:2m,20:5m,50:5m,0:10m" \
       -e API_KEYS="$API_KEYS" \
       -e METHOD=POST \
       -e ENDPOINTS="<job-enqueuing endpoints>" \
       -e BODY_JSON='<payload>' \
       -e VUS=100 \
       tests/loadtest.js
```

- Keep API keys in the environment or your approved secrets store; never commit them.
- Hold each stage longer than the 60s metric period + cooldown + task start-up time, otherwise you will not see the step land.
- End with a `0:<duration>` stage so the scale-in rule (-1 per cooldown) is exercised.
- `VUS` is the maximum VU pool; if k6 reports `dropped_iterations`, the rate exceeded what the VUs/rate limit could deliver. More API keys raise the ceiling (20 concurrent requests per key).
- The default endpoints are read-only `GET`s and do **not** enqueue Resque jobs. To move the backlog you must target endpoints that enqueue jobs onto the `normal` queue (confirm with the Invoiced devs).

**What to observe (outside k6)**

k6 only generates load. Watch these in CloudWatch/ECS during the run:
- `Resque/QueueDepth` (Queue=normal) and the Backlog Per Worker expression
- ECS desired vs running task count and the scaling activity history
- Time for the backlog to drain after load stops

**Things to check**

- Each band produces the expected worker count after one evaluation period.
- Capacity never exceeds 50 and drops by 1 per cooldown once backlog per worker is ≤ 100.
- **Possible flapping:** scale-out uses ExactCapacity, so when backlog per worker falls into the 100–200 band the policy sets the fleet to 2 workers, which can sharply raise backlog per worker and trigger a larger scale-out again. Watch for oscillation near the band edges.

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
| PROFILE          | `iterations` (fixed total) or `steps` (staircase)    | iterations                                                                          |
| STAGES           | `rate:duration` list for `PROFILE=steps`             | 5:2m,20:5m,50:5m,0:10m                                                              |
| START_RATE       | Starting requests/sec for `PROFILE=steps`            | 0                                                                                   |


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



