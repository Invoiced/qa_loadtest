// loadtest.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { b64encode } from 'k6/encoding';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js';

// === ENVIRONMENT CONFIG ===
// Required or defaulted values can be passed via CLI as: VAR=value k6 run loadtest.js
const ENDPOINT      = __ENV.ENDPOINT || 'https://api.staging.invoiced.com/list_events'; // <-- now parameterized!
const METHOD        = (__ENV.METHOD || 'GET').toUpperCase();  // GET | POST | PUT | DELETE
const QUERY         = __ENV.QUERY || '';                      // e.g. "since=2025-01-01&limit=100"
const BODY_JSON     = __ENV.BODY_JSON || '';                  // raw JSON for POST/PUT/PATCH
const SLEEP_SECS    = Number(__ENV.SLEEP || '0');             // pause between iterations
const TIMEOUT_MS    = Number(__ENV.TIMEOUT_MS || '60000');    // request timeout

// Auth options (pick one)
const BEARER_TOKEN  = __ENV.BEARER_TOKEN || '';
const BASIC_USER    = __ENV.BASIC_USER || '';
const BASIC_PASS    = __ENV.BASIC_PASS || '';

// Load profile
const TOTAL_ITERS   = Number(__ENV.TOTAL_ITERATIONS || '500000');
const VUS           = Number(__ENV.VUS || '200');
const MAX_DURATION  = __ENV.MAX_DURATION || '2h';

// === SCENARIO SETTINGS ===
export const options = {
    scenarios: {
        fixed_total: {
            executor: 'shared-iterations',
            vus: VUS,
            iterations: TOTAL_ITERS,
            maxDuration: MAX_DURATION,
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<500'],
    },
};

function buildHeaders() {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
    if (BEARER_TOKEN) {
        headers['Authorization'] = `Bearer ${BEARER_TOKEN}`;
    } else if (BASIC_USER) {
        headers['Authorization'] = `Basic ${b64encode(`${BASIC_USER}:${BASIC_PASS}`)}`;
    }
    return headers;
}

function buildUrl() {
    if (!QUERY) return ENDPOINT;
    const hasQ = ENDPOINT.includes('?');
    return `${ENDPOINT}${hasQ ? '&' : '?'}${QUERY}`;
}

export default function () {
    const url = buildUrl();
    const params = {
        headers: buildHeaders(),
        timeout: `${TIMEOUT_MS}ms`,
    };

    let res;
    if (METHOD === 'GET' || METHOD === 'DELETE') {
        res = http.request(METHOD, url, null, params);
    } else {
        res = http.request(METHOD, url, BODY_JSON || '', params);
    }

    check(res, {
        'status is 2xx': (r) => r.status >= 200 && r.status < 300,
        'duration < 500ms': (r) => r.timings.duration < 500,
    });

    if (SLEEP_SECS > 0) sleep(SLEEP_SECS);
}

export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'summary.json': JSON.stringify(data, null, 2),
    };
}