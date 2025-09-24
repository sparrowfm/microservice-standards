import { ServiceConfig } from './index';

export const DevConfig: ServiceConfig = {
  aws: {
    region: 'us-east-1',
    accountId: process.env.AWS_ACCOUNT_ID || '123456789012',
  },
  api: {
    throttle: {
      rateLimit: 100,
      burstLimit: 200,
    },
  },
  lambdas: {
    timeout: 300, // 5 minutes
    memorySize: 1024,
    // reservedConcurrency: 10, // Disabled for dev - use account default
  },
  storage: {
    s3BucketName: 'your-service-dev',
    cloudfrontDomain: 'cdn-dev.your-domain.com',
  },
  queue: {
    visibilityTimeout: 900, // 15 minutes
    messageRetentionPeriod: 1209600, // 14 days
    maxReceiveCount: 3,
  },
  secrets: {
    exampleApiKey: 'your-service/dev/example-key',
    webhookHmacSecret: 'your-service/dev/webhook-secret',
  },
  monitoring: {
    enableDetailedMetrics: true,
    logRetentionDays: 7,
  },
};