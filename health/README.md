# @aviary/health

Shared health check handler for Aviary microservices.

## Installation

```bash
npm install @aviary/health
```

## Usage

### Basic Health Check

```typescript
import { createHealthHandler } from '@aviary/health';

export const handler = createHealthHandler({
  serviceName: 'my-service',
  version: '1.0.0',
});
```

### With Dependency Checks

```typescript
import { createHealthHandler } from '@aviary/health';

export const handler = createHealthHandler({
  serviceName: 'condor',
  version: '1.0.0',
  dependencies: [
    {
      name: 'Jobs Table',
      type: 'dynamodb',
      resource: 'condor-jobs-dev',
    },
    {
      name: 'Audio Bucket',
      type: 's3',
      resource: 'condor-audio-dev',
    },
    {
      name: 'TTS Queue',
      type: 'sqs',
      resource: 'https://sqs.us-east-1.amazonaws.com/123456789012/condor-tts-queue-dev',
    },
  ],
});
```

### With Custom Checks

```typescript
import { createHealthHandler } from '@aviary/health';

export const handler = createHealthHandler({
  serviceName: 'my-service',
  dependencies: [
    {
      name: 'External API',
      type: 'custom',
      check: async () => {
        try {
          const response = await fetch('https://api.example.com/health');
          return response.ok;
        } catch {
          return false;
        }
      },
    },
  ],
});
```

## Environment Variables

The handler automatically reads these environment variables if not provided in config:

- `SERVICE_VERSION` - Service version
- `GIT_COMMIT` - Git commit hash
- `ENVIRONMENT` - Deployment environment (dev/staging/prod)
- `DEPLOYED_AT` - Deployment timestamp
- `AWS_REGION` - AWS region for dependency checks

## Response Format

### Healthy

```json
{
  "status": "healthy",
  "service": "condor",
  "version": "1.0.0",
  "gitCommit": "abc123",
  "environment": "dev",
  "deployedAt": "2025-12-14T10:00:00Z",
  "timestamp": "2025-12-14T10:05:00Z",
  "uptime": 300,
  "dependencies": [
    {
      "name": "Jobs Table",
      "type": "dynamodb",
      "status": "healthy",
      "resource": "condor-jobs-dev",
      "responseTime": 45
    }
  ]
}
```

### Degraded

Status is `degraded` when some (but not all) dependencies are unhealthy. HTTP status code is 200.

### Unhealthy

Status is `unhealthy` when all dependencies are unhealthy. HTTP status code is 503.

```json
{
  "status": "unhealthy",
  "service": "condor",
  "timestamp": "2025-12-14T10:05:00Z",
  "uptime": 300,
  "dependencies": [
    {
      "name": "Jobs Table",
      "type": "dynamodb",
      "status": "unhealthy",
      "resource": "condor-jobs-dev",
      "error": "ResourceNotFoundException: Table not found",
      "responseTime": 120
    }
  ]
}
```

## CDK Integration

Add health endpoint to your API Gateway:

```typescript
// Create health Lambda
const healthLambda = new lambda.Function(this, 'HealthLambda', {
  functionName: `${serviceName}-health-${environment}`,
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'handlers/health.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '../../dist')),
  timeout: cdk.Duration.seconds(10),
  memorySize: 256,
  environment: {
    SERVICE_VERSION: '1.0.0',
    GIT_COMMIT: process.env.GIT_COMMIT || 'local',
    ENVIRONMENT: environment,
    DEPLOYED_AT: new Date().toISOString(),
  },
});

// Add route to API Gateway
const health = api.root.addResource('health');
health.addMethod('GET', new apigateway.LambdaIntegration(healthLambda), {
  apiKeyRequired: false, // Health checks should be public
});
```

## CI/CD Integration

Use the `verify-health.sh` script to check service health after deployment:

```bash
./scripts/verify-health.sh dev
```

This script checks all services and exits with code 1 if any are unhealthy.
