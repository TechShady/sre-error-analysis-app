/**
 * Minimal SRE Error Analysis App without Strato dependencies
 */

import React, { useState, useEffect } from "react";
import { TOP_ERROR_SERVICES_QUERY } from "./queries";
import { executeQuery } from "./queryClient";
import { ServiceDetailsModal } from "./ServiceDetailsModal";
import "./App.css";

export interface ServiceError {
  service: string;
  service_id: string | null;
  error_count: number;
  total_calls: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  error_rate_percent: number;
}

export const SREErrorAnalysisApp: React.FC = () => {
  const [services, setServices] = useState<ServiceError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceError | null>(null);
  const [sortBy, setSortBy] = useState<string>("error_count");
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    fetchTopErrorServices();
  }, []);

  const fetchTopErrorServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await executeQuery(TOP_ERROR_SERVICES_QUERY);
      const serviceData = (result.records || []).map((record: any) => ({
        service: record.service || "Unknown",
        service_id: typeof record.service_id === "string" ? record.service_id : null,
        error_count: record.error_count || 0,
        total_calls: record.total_calls || 0,
        avg_duration_ms: record.avg_duration_ms || 0,
        p95_duration_ms: record.p95_duration_ms || 0,
        error_rate_percent: record.error_rate_percent || 0,
      }));
      setServices(serviceData);
      setPageIndex(0);
    } catch (err) {
      setError(
        `Failed to load top error services: ${
          err instanceof Error ? err.message : "unknown error"
        }`
      );
      console.error("Query error:", err);
    } finally {
      setLoading(false);
    }
  };

  const sortedServices = [...services].sort((a, b) => {
    const aVal = a[sortBy as keyof ServiceError];
    const bVal = b[sortBy as keyof ServiceError];

    if (typeof aVal === "number" && typeof bVal === "number") {
      return bVal - aVal;
    }

    return String(bVal).localeCompare(String(aVal));
  });

  const start = pageIndex * pageSize;
  const paginatedServices = sortedServices.slice(start, start + pageSize);
  const totalPages = Math.ceil(sortedServices.length / pageSize);

  return (
    <div className="app-container">
      <div className="header">
        <h1>SRE Error Analysis Dashboard</h1>
        <p>Monitor top error-producing services and investigate issues</p>
      </div>

      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading ? (
        <div className="loading">Loading top error services...</div>
      ) : error ? (
        <button onClick={fetchTopErrorServices} className="btn-refresh">
          Retry
        </button>
      ) : services.length === 0 ? (
        <div className="empty-state">
          <p>No error data available for the selected time period</p>
        </div>
      ) : (
        <div>
          <div className="controls">
            <label>
              Sort by:
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="error_count">Error Count</option>
                <option value="error_rate_percent">Error Rate %</option>
                <option value="total_calls">Total Calls</option>
                <option value="avg_duration_ms">Avg Duration</option>
              </select>
            </label>
            <button onClick={fetchTopErrorServices} className="btn-refresh">
              Refresh
            </button>
          </div>

          <table className="services-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Errors (1h)</th>
                <th>Error Rate</th>
                <th>Total Calls</th>
                <th>Avg Duration</th>
                <th>P95 Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedServices.map((service) => (
                <tr key={`${service.service}:${service.service_id ?? ""}`}>
                  <td className="service-name">{service.service}</td>
                  <td className={service.error_count > 100 ? "critical" : "healthy"}>
                    {service.error_count}
                  </td>
                  <td className={service.error_rate_percent > 5 ? "critical" : "healthy"}>
                    {service.error_rate_percent.toFixed(2)}%
                  </td>
                  <td>{service.total_calls.toLocaleString()}</td>
                  <td>{service.avg_duration_ms.toFixed(0)}ms</td>
                  <td>{service.p95_duration_ms.toFixed(0)}ms</td>
                  <td>
                    <button
                      onClick={() => setSelectedService(service)}
                      className="btn-investigate"
                    >
                      Investigate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
              disabled={pageIndex === 0}
              className="btn-pag"
            >
              ← Prev
            </button>
            <span>
              Page {pageIndex + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPageIndex(Math.min(totalPages - 1, pageIndex + 1))}
              disabled={pageIndex >= totalPages - 1}
              className="btn-pag"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {selectedService && (
        <ServiceDetailsModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
        />
      )}
    </div>
  );
};
