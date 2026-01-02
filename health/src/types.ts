/**
 * Types for the health check handler
 */

export interface HealthCheckDependency {
  name: string;
  type: 'dynamodb' | 's3' | 'sqs' | 'custom';
  resource?: string; // Resource name (table, bucket, queue)
  check?: () => Promise<boolean>; // Custom check function
}

export interface HealthCheckConfig {
  serviceName: string;
  version?: string;
  gitCommit?: string;
  environment?: string;
  deployedAt?: string;
  dependencies?: HealthCheckDependency[];
}

export interface DependencyStatus {
  name: string;
  type: string;
  status: 'healthy' | 'unhealthy';
  resource?: string;
  error?: string;
  responseTime?: number;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  version?: string;
  gitCommit?: string;
  environment?: string;
  deployedAt?: string;
  timestamp: string;
  uptime: number;
  dependencies?: DependencyStatus[];
}
