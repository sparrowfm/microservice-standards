import { ServiceConfig } from './index';

export const StagingConfig: ServiceConfig = {
  aws: {
    region: 'us-east-1',
    accountId: process.env.AWS_ACCOUNT_ID || '123456789012',
  },
  api: {
    throttle: {
      rateLimit: 500,
      burstLimit: 1000,
    },
  },
  lambdas: {
    timeout: 300,
    memorySize: 1024,
    reservedConcurrency: 50,
  },
  storage: {
    s3BucketName: 'your-service-staging',
    cloudfrontDomain: 'cdn-staging.your-domain.com',
  },
  queue: {
    visibilityTimeout: 900,
    messageRetentionPeriod: 1209600,
    maxReceiveCount: 3,
  },
  secrets: {
    exampleApiKey: 'your-service/staging/example-key',
    webhookHmacSecret: 'your-service/staging/webhook-secret',
  },
  monitoring: {
    enableDetailedMetrics: true,
    logRetentionDays: 30,
  },
};