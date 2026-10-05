# Step Scaling Test Plan: InvoicedResqueWorker

Status: **Proposed, not implemented.** Saved for reference if the decision is made to add a step-scaling profile to `tests/loadtest.js`.

Assumption: "step scaling" means a step scaling policy (e.g. AWS Application Auto Scaling) on the Resque worker fleet, triggered by a CloudWatch alarm on queue depth or backlog. Confirm this with the infrastructure owners before building.

## Goal

Verify that the InvoicedResqueWorker fleet scales out and in as the step scaling policy intends when the Resque queue backlog rises and falls.

## Approach

1. **Drive the queue, not just the API.** Workers scale on job backlog, so the k6 traffic must enqueue Resque jobs. Read-only endpoints such as `GET /list_events` do not. Candidate job sources (confirm with Invoiced devs which endpoints enqueue to which queue):
   - sending invoices or statements
   - imports and exports
   - webhook deliveries
   - payment processing

2. **Use a staircase load profile.** Use the k6 `ramping-arrival-rate` executor instead of `shared-iterations`. Align each stage with a step in the policy. Example: if the policy adds +1 worker at a backlog of 100, +3 at 500 and +5 at 1000, set the enqueue rate so the backlog climbs through each band.
   - Hold each stage longer than the alarm evaluation period plus instance warm-up.
   - End with a drop to zero load to test scale-in and cooldown.

3. **Measure scaling, not just API results.** Collect alongside the k6 run:
   - queue length per queue (`LLEN resque:queue:<name>` or the CloudWatch metric)
   - alarm state transitions and the scaling activity history
   - desired vs running worker count over time
   - time from enqueue to job start, and time to drain
   - failed Resque jobs, plus Redis and database load

4. **Pass criteria.**
   - Each threshold crossing produces the expected step size.
   - The fleet stops at max capacity.
   - It does not flap.
   - It scales in after cooldown.
   - The backlog drains within the target time.

## Cautions

- **Rate limiting:** the API limits each key to 20 concurrent requests. The Aug 21 run saw about 308k rate-limited requests out of about 388k, and rate-limited requests never enqueue jobs. Use multiple keys via `API_KEYS` and size the arrival rate to what is actually accepted.
- **Staging only:** never run against production. Use test customers so job side effects (emails, gateway calls) are not real. Notify the owners of shared staging before heavy runs.
- **Monitoring access:** requires read access to CloudWatch and Redis metrics. Do not store credentials in scripts or this repo; reference them from the approved secrets store.

## Proposed implementation

Add a `PROFILE=steps` mode to `tests/loadtest.js`:

- New env var `STAGES` in `rate:duration` form, e.g. `STAGES="50:5m,200:5m,500:5m,0:10m"`.
- When `PROFILE=steps`, use `ramping-arrival-rate` with `preAllocatedVUs` and `maxVUs` driven by `VUS`.
- Keep the existing `shared-iterations` behavior as the default.

Example invocation once implemented (keys come from the environment, never typed inline):

```bash
k6 run -e PROFILE=steps \
       -e STAGES="50:5m,200:5m,500:5m,0:10m" \
       -e API_KEYS="$API_KEYS" \
       -e ENDPOINTS="<job-enqueuing endpoints>" \
       -e METHOD=POST -e BODY_JSON='<payload>' \
       tests/loadtest.js
```

## Open questions (needed before implementing)

1. Which endpoints and payloads enqueue Resque jobs, and to which queues?
2. What are the policy's alarm metric, thresholds, step sizes, evaluation period, cooldown and warm-up?
3. What are the min and max worker counts?
4. Who owns the staging worker fleet, and who must be notified before a run?
5. Where do queue-depth and scaling-activity metrics live (CloudWatch namespace, Redis access), and who can grant read access?
