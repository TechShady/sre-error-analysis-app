# SRE Error Analysis Dashboard

A Dynatrace app that provides SRE teams with comprehensive error analysis, deployment correlation, and guided investigation capabilities.

## Deploy to Dynatrace

**Prerequisites:** Node.js 24 and npm, a Dynatrace Gen3 environment with Grail, and a Dynatrace user with `app-engine:apps:install` and `app-engine:apps:run`. Dashboard users also need read access to the relevant Grail buckets, spans, logs, events, and system data.

Clone the repository, install dependencies, and deploy. Replace `YOUR-ENVIRONMENT-ID` with your Dynatrace environment ID:

```shell
git clone https://github.com/TechShady/sre-error-analysis-app.git
cd sre-error-analysis-app
npm ci
npm run deploy -- --environment-url https://YOUR-ENVIRONMENT-ID.apps.dynatrace.com
```

The Dynatrace App Toolkit builds and uploads the app. Complete sign-in in your browser if prompted; you don't need to create an API token for this workflow. After deploying, find **SRE Error Analysis Dashboard** in the Dynatrace app launcher, or open `https://YOUR-ENVIRONMENT-ID.apps.dynatrace.com/ui/apps/my.sre.error.analysis/`.

- To build a ZIP in `out` without uploading anything, run `npm run deploy -- --dry-run --environment-url https://YOUR-ENVIRONMENT-ID.apps.dynatrace.com`. The toolkit still needs a real environment URL.
- To set a default target for future `npm run deploy` calls, replace `environmentUrl` in your local [app.config.json](./app.config.json). Keep your tenant-specific setting out of commits.
- Before deploying an update, increment `app.version` in [app.config.json](./app.config.json).

## Features

### 🎯 Top Error-Producing Services
- Real-time monitoring of services with the highest error rates in the last hour
- Error count, error rate percentage, total calls, and latency metrics
- Color-coded severity indicators for quick visual assessment

### 📊 Key Metrics Displayed
- **Error Count**: Number of errors in the past hour
- **Error Rate**: Percentage of failed requests
- **Total Calls**: Total number of service calls
- **Average Duration**: Mean response time
- **P95 Duration**: 95th percentile response time

### 🔍 Guided Investigation Actions

For each error-producing service, SREs can:

1. **Distributed Traces** - Analyze request flows and identify failing dependencies
2. **Error Logs** - Review raw error messages and stack traces
3. **Problems** - View AI-detected problems and root cause analysis

### 📈 Deployment Correlation
- View recent deployments (last 7 days)
- Correlate error spikes with deployment times
- Identify if errors are post-deployment issues
- Track deployment versions and release names

### 🐛 Error Analysis Details
- **Error Logs Tab**: Last hour of ERROR and FATAL level logs
- **Problems Tab**: DAVIS-detected problems affecting the service
- **Investigation Guide**: Step-by-step guidance for troubleshooting

## DQL Queries

The app uses the following DQL queries:

### Top Error Services (1-hour window)
```dql
fetch spans, from: now() - 1h
| filter request.is_root_span == true and isNotNull(dt.service.name)
| fieldsAdd service_id = coalesce(toString(dt.smartscape.service), dt.entity.service)
| summarize
    error_count = countIf(request.is_failed == true),
    total_calls = count(),
    avg_duration = avg(duration),
    p95_duration = percentile(duration, 95),
    by: {service = dt.service.name, service_id}
| filter error_count > 0
| fieldsAdd error_rate_percent = error_count * 100.0 / total_calls,
    avg_duration_ms = avg_duration / 1ms,
    p95_duration_ms = p95_duration / 1ms
| sort error_count desc
| limit 10
| fields service, service_id, error_count = toDouble(error_count), total_calls = toDouble(total_calls),
    avg_duration_ms, p95_duration_ms, error_rate_percent
```

### Service Deployments (7-day window)
Fetches recent deployments for correlation with error spikes

### Error Logs (1-hour window)
Retrieves ERROR and FATAL logs for the selected service. Logs without service tags can match through their trace and span IDs. The Error Logs tab and Gen3 Logs link use the same filter.

### Detected Problems (7-day window)
Shows AI-detected problems for the selected service by entity ID, including status and detected root cause when available.

The investigation links open the Gen3 Distributed Tracing, Logs, and Problems apps. Traces and Logs open with the service context; **View Problems** opens the full Problems app, while the dashboard's **Problems** tab shows service-specific results.

## User Guide

### Getting Started
1. Open the SRE Error Analysis Dashboard
2. Review the top 10 error-producing services
3. Click "Investigate" on any service to deep dive

### Investigation Workflow
1. **Check Recent Deployments** - Identify if errors correlate with releases
2. **Analyze Error Logs** - Find common error patterns
3. **Review Detected Problems** - See if Dynatrace's AI has identified root causes
4. **Investigate Service Dependencies** - Use distributed traces to find bottlenecks

### Key Indicators
- **Red/Critical** - Error rate > 5% or high error counts
- **Green/Success** - Error rate < 5%
- **P95 Duration** - Indicates tail latency issues

## Technical Details

### Technology Stack
- **React 18** - UI framework
- **TypeScript** - Type-safe code
- **Dynatrace SDK** - App navigation and query execution
- **DQL** - Dynatrace Query Language for data analysis

### Permissions Required
- Read access to the Grail buckets and the span, event, log, and system data used by the dashboard.

## Performance Considerations

- Queries are limited to 1000 records
- 30-second execution timeout for data freshness
- Automatic polling for long-running queries
- Pagination for large result sets

## Future Enhancements

- Custom time range selection
- Filter by service team or owner
- Alert threshold configuration
- Automated remediation suggestions
- SLO tracking and compliance
- Custom metric thresholds per environment
