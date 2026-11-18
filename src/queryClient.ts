/**
 * Query client utilities for executing DQL queries
 */

import { queryExecutionClient } from "@dynatrace-sdk/client-query";

export interface QueryResult {
  records: Array<Record<string, any>>;
  metadata: {
    grail: {
      query: string;
      executionTimeMilliseconds: number;
      scannedRecords: number;
    };
  };
}

export async function executeQuery(query: string): Promise<QueryResult> {
  try {
    const response = await queryExecutionClient.queryExecute({
      body: {
        query,
        requestTimeoutMilliseconds: 30000,
        maxResultRecords: 1000,
      },
    });

    if (response.state === "SUCCEEDED" && response.result) {
      return response.result as QueryResult;
    } else if (response.state === "RUNNING" || response.state === "NOT_STARTED") {
      if (response.requestToken) {
        return await pollQuery(response.requestToken);
      }
    }

    throw new Error(
      `Query failed with state: ${response.state || "unknown"}`
    );
  } catch (error) {
    console.error("Query execution error:", error);
    throw error;
  }
}

async function pollQuery(
  requestToken: string,
  maxAttempts: number = 60
): Promise<QueryResult> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await queryExecutionClient.queryPoll({
        requestToken,
        requestTimeoutMilliseconds: 5000,
      });

      if (response.state === "SUCCEEDED" && response.result) {
        return response.result as QueryResult;
      } else if (response.state === "FAILED") {
        throw new Error("Query execution failed");
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error("Poll error:", error);
      throw error;
    }
  }

  throw new Error("Query polling timeout");
}
