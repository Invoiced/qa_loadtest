// loadtest.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { b64encode } from 'k6/encoding';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

// === ENVIRONMENT CONFIG ===
const BASE_URL      = __ENV.BASE_URL || 'https://api.invoiced-backend-staging.invoiced.com';
const METHOD        = (__ENV.METHOD || 'GET').toUpperCase();
const QUERY         = __ENV.QUERY;  // undefined = not set; '' = explicitly empty (no query)
const BODY_JSON     = __ENV.BODY_JSON || '';
const SLEEP_SECS    = Number(__ENV.SLEEP || '0');
const TIMEOUT_MS    = Number(__ENV.TIMEOUT_MS || '60000');

// Multiple API keys — comma-separated. Each key gets its own 20-concurrent-request allowance.
// Example: -e API_KEYS="key1,key2,key3"
const API_KEYS      = (__ENV.API_KEYS || '').split(',').filter(k => k.trim());
const BASIC_PASS    = __ENV.BASIC_PASS || '';

// Single key fallback (backwards compatible)
const BEARER_TOKEN  = __ENV.BEARER_TOKEN || '';
const BASIC_USER    = __ENV.BASIC_USER || '';

// Load profile
const TOTAL_ITERS   = Number(__ENV.TOTAL_ITERATIONS || '500000');
const VUS           = Number(__ENV.VUS || '200');
const MAX_DURATION  = __ENV.MAX_DURATION || '2h';

// Endpoint rotation — CPU-intensive endpoints that stress PHP + DB.
// Override with: -e ENDPOINTS="/customers,/invoices,/events"
const DEFAULT_ENDPOINTS = [
    '/customers',
    '/invoices',
    '/events',
    '/credit_notes',
    '/subscriptions',
    '/payments',
    '/estimates',
];
const ENDPOINTS = __ENV.ENDPOINTS
    ? __ENV.ENDPOINTS.split(',').map(e => e.trim())
    : DEFAULT_ENDPOINTS;

// Step-scaling profile: PROFILE=steps drives a staircase arrival rate (requests/sec)
// so the Resque queue backlog climbs through the autoscaling policy's bands.
// STAGES format is "rate:duration,..." e.g. "5:2m,20:5m,50:5m,0:10m".
// Policy reference: config/autoscaling-policy.json, docs/step-scaling-test-plan.md
const PROFILE       = (__ENV.PROFILE || 'iterations').toLowerCase();
const START_RATE    = Number(__ENV.START_RATE || '0');
const DEFAULT_STAGES = '5:2m,20:5m,50:5m,0:10m';

function parseStages(spec) {
    return spec.split(',').map(s => s.trim()).filter(Boolean).map(s => {
        const [rate, duration] = s.split(':');
        if (!/^\d+$/.test(rate || '') || !/^(\d+[hms])+$/.test(duration || '')) {
            throw new Error(`Invalid STAGES entry "${s}" — expected rate:duration, e.g. 50:5m`);
        }
        return { target: Number(rate), duration };
    });
}

function buildScenarios() {
    if (PROFILE === 'steps') {
        return {
            step_scaling: {
                executor: 'ramping-arrival-rate',
                startRate: START_RATE,
                timeUnit: '1s',
                preAllocatedVUs: Math.min(VUS, 50),
                maxVUs: VUS,
                stages: parseStages(__ENV.STAGES || DEFAULT_STAGES),
            },
        };
    }
    if (PROFILE !== 'iterations') {
        throw new Error(`Unknown PROFILE "${PROFILE}" — use "iterations" (default) or "steps"`);
    }
    return {
        fixed_total: {
            executor: 'shared-iterations',
            vus: VUS,
            iterations: TOTAL_ITERS,
            maxDuration: MAX_DURATION,
        },
    };
}

// === SCENARIO SETTINGS ===
export const options = {
    scenarios: buildScenarios(),
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<2000'],
    },
};

// Pre-compute auth headers for each API key to avoid repeated encoding
const AUTH_HEADERS = API_KEYS.map(key => ({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Basic ${b64encode(`${key.trim()}:${BASIC_PASS}`)}`,
}));

// Fallback single-key header
function buildFallbackHeaders() {
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

const FALLBACK_HEADERS = buildFallbackHeaders();

export default function () {
    // Distribute VUs across API keys — each VU uses a consistent key based on its ID.
    // This spreads load evenly so no single key exceeds 20 concurrent requests.
    let headers;
    if (AUTH_HEADERS.length > 0) {
        const keyIndex = __VU % AUTH_HEADERS.length;
        headers = AUTH_HEADERS[keyIndex];
    } else {
        headers = FALLBACK_HEADERS;
    }

    // Rotate endpoints across iterations to hit different DB tables and PHP code paths
    const endpointIndex = (__ITER + __VU) % ENDPOINTS.length;
    const endpoint = ENDPOINTS[endpointIndex];
    let url = `${BASE_URL}${endpoint}`;

    // Add query params if provided; default to heavy DB query when QUERY is not set at all
    const heavyQuery = QUERY !== undefined ? QUERY : 'per_page=100&sort=created_at';
    if (heavyQuery) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}${heavyQuery}`;
    }

    const params = {
        headers: headers,
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
        'not rate limited': (r) => r.status !== 429,
        'not 502 bad gateway': (r) => r.status !== 502,
        'not 504 gateway timeout': (r) => r.status !== 504,
        'no TLS/SSL error': (r) => r.status !== 0 || !r.error || (!r.error.includes('tls:') && !r.error.includes('SSL') && !r.error.includes('certificate')),
        'duration < 2000ms': (r) => r.timings.duration < 2000,
    });

    if (SLEEP_SECS > 0) sleep(SLEEP_SECS);
}

export function handleSummary(data) {
    const reportFile = __ENV.REPORT_FILE || 'tests/report.html';
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'tests/summary.json': JSON.stringify(data, null, 2),
        [reportFile]: htmlReport(data),
    };
}
