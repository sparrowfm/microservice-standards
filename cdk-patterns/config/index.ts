import { DevConfig } from './dev';
import { StagingConfig } from './staging';
import { ProdConfig } from './prod';

export interface ServiceConfig {
  aws: {
    region: string;
    accountId: string;
  };
  api: {
    throttle: {
      rateLimit: number;
      burstLimit: number;
    };
  };
  lambdas: {
    timeout: number;
    memorySize: number;
    reservedConcurrency?: number;
  };
  storage: {
    s3BucketName: string;
    cloudfrontDomain: string;
  };
  queue: {
    visibilityTimeout: number;
    messageRetentionPeriod: number;
    maxReceiveCount: number;
  };
  secrets: {
    // Add your service-specific secrets here
    exampleApiKey: string;
    webhookHmacSecret: string;
  };
  monitoring: {
    enableDetailedMetrics: boolean;
    logRetentionDays: number;
  };
}

export function getConfig(environment: string): ServiceConfig {
  switch (environment) {
    case 'dev':
      return DevConfig;
    case 'staging':
      return StagingConfig;
    case 'prod':
      return ProdConfig;
    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
}