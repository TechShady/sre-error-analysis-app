/**
 * Service details modal component - simplified version without Strato
 */

import React, { useState, useEffect } from "react";
import { getAppLink, getIntentLink } from "@dynatrace-sdk/navigation";
import type { ServiceError } from "./App";
import {
  serviceErrorLogFilter,
  SERVICE_DEPLOYMENT_QUERY,
  SERVICE_ERROR_LOGS_QUERY,
  SERVICE_PROBLEMS_QUERY,
} from "./queries";
import { executeQuery } from "./queryClient";

interface ServiceDetailsModalProps {
  service: ServiceError;
  onClose: () => void;
}

interface DeploymentRecord {
  timestamp?: number;
  event_type?: string;
  event_entity_name?: string;
  event_name?: string;
  event_deployment_release_version?: string;
  event_deployment_release_name?: string;
}

interface LogRecord {
  timestamp?: string;
  loglevel?: string;
  content?: string;
  exception_message?: string;
}

interface ProblemRecord {
  timestamp?: string;
  display_id?: string;
  display_name?: string;
  status?: string;
  root_cause_service?: string;
  duration_ms?: number;
}

export const ServiceDetailsModal: React.FC<ServiceDetailsModalProps> = ({
  service,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [errorLogs, setErrorLogs] = useState<LogRecord[]>([]);
  const [problems, setProblems] = useState<ProblemRecord[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "deployments") {
      fetchDeployments();
    } else if (activeTab === "logs") {
      fetchErrorLogs();
    } else if (activeTab === "problems") {
      fetchProblems();
    }
  }, [activeTab]);

  const fetchDeployments = async () => {
    setTabLoading(true);
    setTabError(null);
    try {
      const result = await executeQuery(SERVICE_DEPLOYMENT_QUERY(service.service));
      setDeployments((result.records || []).slice(0, 10));
    } catch (err) {
      setTabError(
        `Failed to load deployments: ${err instanceof Error ? err.message : "unknown error"}`
      );
    } finally {
      setTabLoading(false);
    }
  };

  const fetchErrorLogs = async () => {
    setTabLoading(true);
    setTabError(null);
    try {
      const result = await executeQuery(SERVICE_ERROR_LOGS_QUERY(service.service, service.service_id));
      setErrorLogs((result.records || []).slice(0, 10));
    } catch (err) {
      setTabError(
        `Failed to load logs: ${err instanceof Error ? err.message : "unknown error"}`
      );
    } finally {
      setTabLoading(false);
    }
  };

  const fetchProblems = async () => {
    if (!service.service_id) {
      setTabError("This service has no entity ID, so matching problems cannot be determined.");
      return;
    }
    setTabLoading(true);
    setTabError(null);
    try {
      const result = await executeQuery(SERVICE_PROBLEMS_QUERY(service.service_id));
      setProblems((result.records || []).slice(0, 10));
    } catch (err) {
      setTabError(
        `Failed to load problems: ${err instanceof Error ? err.message : "unknown error"}`
      );
    } finally {
      setTabLoading(false);
    }
  };

  const traceLink = getIntentLink(
    {
      "dt.filter": `dt.service.name == ${JSON.stringify(service.service)} and request.is_failed == true`,
      "dt.timeframe": { from: "now()-1h", to: "now()" },
    },
    "dynatrace.distributedtracing",
    "view-traces",
  );
  const logsLink = getIntentLink(
    { "dt.query": serviceErrorLogFilter(service.service, service.service_id), showDqlEditor: true },
    "dynatrace.logs",
    "view_query",
  );
  const problemsLink = getAppLink("dynatrace.davis.problems");

  const formatTimestamp = (ts?: string | number) => {
    if (!ts) return "Unknown";
    const date = new Date(ts);
    return date.toLocaleString();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{service.service}</h2>
            <p style={{ margin: "4px 0 0 0", color: "#666", fontSize: "12px" }}>
              Error Rate: {service.error_rate_percent.toFixed(2)}% | Errors (1h): {service.error_count}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`modal-tab ${activeTab === "deployments" ? "active" : ""}`}
            onClick={() => setActiveTab("deployments")}
          >
            Deployments
          </button>
          <button
            className={`modal-tab ${activeTab === "logs" ? "active" : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            Error Logs
          </button>
          <button
            className={`modal-tab ${activeTab === "problems" ? "active" : ""}`}
            onClick={() => setActiveTab("problems")}
          >
            Problems
          </button>
        </div>

        <div className="modal-content">
          {activeTab === "overview" && (
            <div>
              <div className="investigation-guide">
                <h3>Investigation Guide</h3>
                <ol>
                  <li><strong>Check Recent Deployments:</strong> Review recent deployments to correlate with error spikes</li>
                  <li><strong>Review Error Logs:</strong> Examine error patterns and stack traces in the Error Logs tab</li>
                  <li><strong>Analyze Problems:</strong> Check detected problems for root cause analysis</li>
                  <li><strong>Trace Errors:</strong> Use the distributed trace link to see detailed request flows</li>
                  <li><strong>Monitor Duration:</strong> Compare avg duration ({service.avg_duration_ms.toFixed(0)}ms) with P95 ({service.p95_duration_ms.toFixed(0)}ms) for anomalies</li>
                </ol>
              </div>

              <div style={{ marginTop: "20px" }}>
                <h3 style={{ marginBottom: "12px", fontSize: "14px", fontWeight: 600 }}>
                  Service Metrics
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ padding: "12px", background: "#f5f5f5", borderRadius: "4px" }}>
                    <strong style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "4px" }}>
                      Total Errors (1h)
                    </strong>
                    <div style={{ fontSize: "20px", fontWeight: "bold", color: "#d33200" }}>
                      {service.error_count}
                    </div>
                  </div>
                  <div style={{ padding: "12px", background: "#f5f5f5", borderRadius: "4px" }}>
                    <strong style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "4px" }}>
                      Error Rate
                    </strong>
                    <div style={{ fontSize: "20px", fontWeight: "bold", color: service.error_rate_percent > 5 ? "#d33200" : "#70bf2b" }}>
                      {service.error_rate_percent.toFixed(2)}%
                    </div>
                  </div>
                  <div style={{ padding: "12px", background: "#f5f5f5", borderRadius: "4px" }}>
                    <strong style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "4px" }}>
                      Avg Duration
                    </strong>
                    <div style={{ fontSize: "20px", fontWeight: "bold" }}>
                      {service.avg_duration_ms.toFixed(0)}ms
                    </div>
                  </div>
                  <div style={{ padding: "12px", background: "#f5f5f5", borderRadius: "4px" }}>
                    <strong style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "4px" }}>
                      Total Calls
                    </strong>
                    <div style={{ fontSize: "20px", fontWeight: "bold" }}>
                      {service.total_calls.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: "24px" }}>
                <a href={traceLink} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  View Traces
                </a>
                <a href={logsLink} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  View Logs
                </a>
                <a href={problemsLink} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  View Problems
                </a>
              </div>
            </div>
          )}

          {activeTab === "deployments" && (
            <div>
              {tabLoading ? (
                <div className="tab-loading">Loading deployments...</div>
              ) : tabError ? (
                <div style={{ color: "#d33200", padding: "20px" }}>{tabError}</div>
              ) : deployments.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
                  No recent deployments found
                </div>
              ) : (
                <div>
                  {deployments.map((dep, idx) => (
                    <div key={idx} className="deployment-item">
                      <strong>{dep.event_deployment_release_name || "Deployment"}</strong>
                      <small>Version: {dep.event_deployment_release_version || "Unknown"}</small>
                      <small>Time: {formatTimestamp(dep.timestamp)}</small>
                      {dep.event_name && <small>Event: {dep.event_name}</small>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "logs" && (
            <div>
              {tabLoading ? (
                <div className="tab-loading">Loading error logs...</div>
              ) : tabError ? (
                <div style={{ color: "#d33200", padding: "20px" }}>{tabError}</div>
              ) : errorLogs.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
                  No error logs matched this service in the last hour
                </div>
              ) : (
                <div>
                  {errorLogs.map((log, idx) => (
                    <div key={idx} className="log-item">
                      <strong style={{ color: "#d33200" }}>
                        {log.loglevel || "ERROR"}
                      </strong>
                      <div style={{ marginTop: "8px", fontSize: "13px", lineHeight: "1.5" }}>
                        {log.content || "No content"}
                      </div>
                      {log.exception_message && (
                        <div style={{ marginTop: "8px", fontSize: "12px", color: "#666", fontFamily: "monospace" }}>
                          Exception: {log.exception_message}
                        </div>
                      )}
                      <small>Time: {formatTimestamp(log.timestamp)}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "problems" && (
            <div>
              {tabLoading ? (
                <div className="tab-loading">Loading problems...</div>
              ) : tabError ? (
                <div style={{ color: "#d33200", padding: "20px" }}>{tabError}</div>
              ) : problems.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
                  No detected problems
                </div>
              ) : (
                <div>
                  {problems.map((problem, idx) => (
                    <div key={idx} className="problem-item">
                      <strong>{problem.display_id ? `${problem.display_id}: ` : ""}{problem.display_name || "Problem Detected"}</strong>
                      <small>Status: {problem.status || "Unknown"}</small>
                      {problem.root_cause_service && (
                        <small>Root Cause: {problem.root_cause_service}</small>
                      )}
                      {problem.duration_ms != null && (
                        <small>Duration: {(problem.duration_ms / 1000 / 60).toFixed(1)} minutes</small>
                      )}
                      <small>Time: {formatTimestamp(problem.timestamp)}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
