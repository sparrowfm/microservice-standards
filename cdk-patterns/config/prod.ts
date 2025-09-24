import { ServiceConfig } from './index';

export const ProdConfig: ServiceConfig = {
  aws: {
    region: 'us-east-1',
    accountId: process.env.AWS_ACCOUNT_ID || '123456789012',
  },
  api: {
    throttle: {
      rateLimit: 2000,
      burstLimit: 5000,
    },
  },
  lambdas: {
    timeout: 600, // 10 minutes for production
    memorySize: 2048,
    reservedConcurrency: 200,
  },
  storage: {
    s3BucketName: 'your-service-prod',
    cloudfrontDomain: 'cdn.your-domain.com',
  },
  queue: {
    visibilityTimeout: 1800, // 30 minutes
    messageRetentionPeriod: 1209600,
    maxReceiveCount: 5,
  },
  secrets: {
    exampleApiKey: 'your-service/prod/example-key',
    webhookHmacSecret: 'your-service/prod/webhook-secret',
  },
  monitoring: {
    enableDetailedMetrics: true,
    logRetentionDays: 90,
  },
};