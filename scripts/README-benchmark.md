# Benchmark Scripts

These scripts help validate launch quality quickly with repeatable outputs.

## 1) Category accuracy benchmark

Runs a 25-SKU dataset against `POST /api/suggest-from-images` using product names.

```bash
node scripts/benchmark-category-accuracy.js
```

Optional env:

- `BENCHMARK_ENDPOINT` (default: `http://127.0.0.1:4174/api/suggest-from-images`)
- `BENCHMARK_OUT_DIR` (default: `scripts/benchmark-output`)

Output:

- JSON report with category/group match details and summary rates.

## 2) Launch KPI benchmark

Checks launch KPI thresholds from admin launch-metrics endpoint.

```bash
node scripts/benchmark-launch-kpi.js
```

Optional env:

- `BENCHMARK_METRICS_ENDPOINT` (default: `http://127.0.0.1:4174/api/admin/launch-metrics?days=14`)
- `BENCHMARK_OUT_DIR` (default: `scripts/benchmark-output`)

Thresholds (current):

- generate success rate >= 97%
- first output completion rate >= 80%
- average first output latency < 10s

If `/api/admin/launch-metrics` is protected, pass admin session cookie:

```bash
BENCHMARK_AUTH_COOKIE="sb-access-token=...; sb-refresh-token=..." node scripts/benchmark-launch-kpi.js
```

## 3) Benchmark orchestrator (automation entry)

Runs category benchmark + launch KPI benchmark, then writes a summary file and fails process when thresholds are not met.

```bash
node scripts/benchmark-orchestrator.js
```

Optional env:

- `BENCHMARK_ENDPOINT` (default production suggest endpoint)
- `BENCHMARK_METRICS_ENDPOINT` (default production launch metrics endpoint)
- `BENCHMARK_OUT_DIR` (default `scripts/benchmark-output`)
- `BENCHMARK_AUTH_COOKIE` (optional admin cookie for launch KPI endpoint)
- `MIN_CATEGORY_ACCURACY` (default `85`)
- `MIN_GROUP_ACCURACY` (default `90`)
- `MIN_CONFIDENT_RATE` (default `70`)
- `BENCHMARK_ALERT_WEBHOOK_URL` (optional webhook receives warning/fail alerts)

Output:

- `benchmark-summary-<timestamp>.json` with overall pass/warn/fail status.
