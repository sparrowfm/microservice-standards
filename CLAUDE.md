# Microservice Standards - Shared Patterns

Reusable CDK constructs, authentication utilities, and common patterns for Aviary v2 services.

## CloudWatch Alarms Factory (Dec 2025)

**Location**: `cdk-patterns/lib/lambda-alarms.ts`

Standardized CloudWatch alarms for all Lambda functions across Aviary services.

**Alarms per Lambda:**
- Error Rate: >5% for 2 consecutive 1-min periods
- Duration (p99): >10s (service-specific thresholds) for 2 consecutive periods
- Throttles: Any throttles (>0)
- DLQ (async only): Queue messages >0

**Usage Pattern:**
```typescript
import { LambdaAlarms, createAlarmTopic } from '../../microservice-standards/cdk-patterns/lib/lambda-alarms';

// Create shared SNS topic for alarm notifications
const alarmTopic = createAlarmTopic(this, 'AlarmTopic', {
  serviceName: 'myservice',
  environment: 'dev',
});

// Add alarms to individual Lambda functions
new LambdaAlarms(this, 'MyLambdaAlarms', {
  lambdaFunction: myLambda,
  serviceName: 'myservice',
  environment: 'dev',
  alarmTopic,
  durationThresholdSeconds: 30,  // Service-specific - tune per Lambda
  errorRateThresholdPercent: 5,  // Default, can override
});
```

**Key Configuration:**
- `durationThresholdSeconds`: Tune per Lambda based on normal execution time (see service CLAUDE.md for values)
- Each service exports `AlarmTopicArn` from CDK stack for subscription configuration
- Email subscriptions require confirmation via link sent to subscriber email

**Deployment Status (Dec 14, 2025):**
- 125 alarms across 9 services (all deployed and live)
- SNS topics created for alarm notifications
- Email subscriptions pending confirmation

## Authentication Module (`auth/`)

Shared authentication utilities and middleware for API Gateway protection.

**Location**: `auth/`
**Exports**: API key validation, request signing, middleware helpers

**Key Files:**
- `auth/middleware/` - Express/Lambda authentication middleware
- `auth/utils/` - Helper functions for auth logic

## Health Check Module (`health/`)

Standardized health check implementations for Lambda functions.

**Location**: `health/`
**Purpose**: Provides health endpoints for Lambda-based services (API, worker, etc.)

## ESM Module Resolution Gotchas

**Critical**: Services using `node16`/`nodenext` moduleResolution require `.js` extensions in TypeScript imports.

**Pattern:**
```typescript
// Correct - includes .js extension
import { LambdaAlarms } from '../../microservice-standards/cdk-patterns/lib/lambda-alarms.js';

// Wrong - will fail in CDK services with node16 resolution
import { LambdaAlarms } from '../../microservice-standards/cdk-patterns/lib/lambda-alarms';
```

This is a TypeScript→ESM compilation requirement when `moduleResolution: "node16"` or `"nodenext"` is configured in tsconfig.json.

## CDK Configuration Patterns

**TypeScript Compilation**: Services with pre-compiled CDK need tsconfig to include all imported source files:

```json
{
  "compilerOptions": {
    "rootDir": "..",
    "include": ["bin/**/*.ts", "lib/**/*.ts", "../microservice-standards/cdk-patterns/**/*.ts"]
  }
}
```

When `rootDir` changes to parent directory, `cdk.json` app path must be updated:
```json
{
  "app": "node dist/cdk/bin/cdk.js"  // Reflects nested rootDir structure
}
```

## .gitignore Pattern Scoping

**Pattern `lib/` without `/` matches ALL lib directories** in the repo, including `cdk/lib/` (source code).

**Correct pattern:**
```
/lib/              # Matches only root-level lib/ (build output)
!cdk/lib/          # Exclude cdk/lib/ from ignore (CDK source code)
```

This allows build output (`/lib/`) to be ignored while preserving CDK source code (`cdk/lib/`) in version control.

## Related Documentation

- Individual service CLAUDE.md files document service-specific alarm thresholds
- `../CLAUDE.md` - Platform-wide architecture and patterns
