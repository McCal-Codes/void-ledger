export type HealthOverallStatus = "healthy" | "degraded" | "stale" | "error";

export type HealthCheckStatus = "healthy" | "degraded" | "stale" | "waiting" | "ignored" | "error";

export type HealthCheck = {
  status: HealthCheckStatus;
  label: string;
  lastUpdated?: string;
  ageSeconds?: number | null;
  summary?: Record<string, string | number | boolean | null | undefined>;
  message: string;
};

export type DataHealthResponse = {
  overall: HealthOverallStatus;
  checkedAt: string;
  checks: {
    accountInventory: HealthCheck;
    alecaframeCache: HealthCheck;
    fissures: HealthCheck;
    baro: HealthCheck;
    primeMarket: HealthCheck;
    googleSheet: HealthCheck;
  };
};
