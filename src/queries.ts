/**
 * DQL queries for SRE error analysis
 */

export const TOP_ERROR_SERVICES_QUERY = `
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
`;

export const SERVICE_DEPLOYMENT_QUERY = (serviceName: string) => `
fetch events
| filter event.type == "deployment" OR event.type == "DEPLOYMENT"
| filter timestamp >= now() - 7d
| filter contains(event.entity.name, "${serviceName}") OR contains(dt.entity.application, "${serviceName}")
| fields
    timestamp,
    event.type,
    event.entity.name,
    event.name,
    event.deployment.release_version,
    event.deployment.release_name
| sort timestamp desc
| limit 20
`;

export function serviceErrorLogFilter(serviceName: string, serviceId: string | null) {
  const name = JSON.stringify(serviceName);
  const id = JSON.stringify(serviceId);
  const logServiceFilter = serviceId
    ? `in(dt.smartscape.service, toSmartscapeId(${id})) or in(dt.entity.service, ${id}) or `
    : "";
  const spanServiceFilter = serviceId
    ? `dt.smartscape.service == toSmartscapeId(${id}) or dt.entity.service == ${id}`
    : `dt.service.name == ${name}`;
  return `fetch logs, from: now() - 1h
| filter loglevel == "ERROR" or loglevel == "FATAL" or (isNull(loglevel) and (status == "ERROR" or status == "FATAL"))
| filter ${logServiceFilter}dt.service.name == ${name} or service.name == ${name}
    or concat(coalesce(trace_id, toString(trace.id)), ":", coalesce(span_id, toString(span.id))) in [
      fetch spans, from: now() - 1h
      | filter ${spanServiceFilter}
      | filter isNotNull(trace.id) and isNotNull(span.id)
      | fields concat(toString(trace.id), ":", toString(span.id))
    ]`;
}

export const SERVICE_ERROR_LOGS_QUERY = (serviceName: string, serviceId: string | null) => `
${serviceErrorLogFilter(serviceName, serviceId)}
| fields timestamp, loglevel = coalesce(loglevel, status), content, exception_message = exception.message
| sort timestamp desc
| limit 50
`;

export const SERVICE_PROBLEMS_QUERY = (serviceId: string) => `
fetch dt.davis.problems, from: now() - 7d
| filter not(dt.davis.is_duplicate)
| filter in(dt.smartscape.service, toSmartscapeId(${JSON.stringify(serviceId)}))
    or in(smartscape.affected_entity.ids, toSmartscapeId(${JSON.stringify(serviceId)}))
    or in(dt.entity.service, ${JSON.stringify(serviceId)})
| fields
    timestamp = event.start,
    display_id,
    display_name = event.name,
    status = event.status,
    root_cause_service = root_cause_entity_name,
    duration_ms = (coalesce(event.end, now()) - event.start) / 1ms
| sort timestamp desc
| limit 10
`;

export const DEPLOYMENT_ERROR_CORRELATION_QUERY = (serviceName: string) => `
fetch events
| filter event.type == "deployment" OR event.type == "DEPLOYMENT"
| filter timestamp >= now() - 7d
| filter contains(event.entity.name, "${serviceName}") OR contains(dt.entity.application, "${serviceName}")
| fieldsAdd deployment_time = timestamp
| join [
    fetch spans
    | filter timestamp >= now() - 7d
    | filter contains(dt.smartscape.service, "${serviceName}")
    | filter span.status == "ERROR"
    | summarize error_count = count(), by {service = dt.smartscape.service}
    | fieldsAdd analysis_start = deployment_time
  ],
  left: left.timestamp = right.analysis_start
| sort timestamp desc
| limit 20
`;
