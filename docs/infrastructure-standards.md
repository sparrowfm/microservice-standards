# Infrastructure Standards

## Core Principles

- **Environment-based configuration**: Different settings for dev/staging/prod
- **Security by environment**: Stricter controls in production
- **Cost optimization**: Right-size resources per environment
- **KISS and YAGNI**: Start simple, add complexity only when needed

## Universal Best Practices

### 1. Environment-Specific Configuration Management

**Pattern**: Centralized config with environment-specific overrides

```typescript
// config/index.ts
export interface ServiceConfig {
  aws: { region: string; accountId: string };
  api: { throttle: { rateLimit: number; burstLimit: number } };
  lambdas: { timeout: number; memorySize: number; reservedConcurrency?: number };
  storage: { s3BucketName: string; cloudfrontDomain: string };
  monitoring: { logRetentionDays: number; enableDetailedMetrics: boolean };
}

// config/dev.ts
export const DevConfig: ServiceConfig = {
  aws: { region: 'us-east-1', accountId: process.env.AWS_ACCOUNT_ID || '123456789012' },
  api: { throttle: { rateLimit: 100, burstLimit: 200 } },
  lambdas: { timeout: 300, memorySize: 1024 },
  storage: { s3BucketName: 'my-service-dev', cloudfrontDomain: '' },
  monitoring: { logRetentionDays: 7, enableDetailedMetrics: true },
};
```

**Benefits**: Type safety, environment isolation, easy scaling
**Replicate**: Always - this is fundamental to multi-environment deployments

### 2. Resource Naming Conventions

**Pattern**: `{service}-{environment}-{resource-type}`

```typescript
const functionName = `my-service-${environment}-health`;
const tableName = `my-service-jobs-${environment}`;
const bucketName = `my-service-artifacts-${environment}`;
```

**Benefits**: Clear ownership, easy filtering, environment isolation
**Replicate**: Always - essential for resource management

### 3. Environment-Based Security Policies

**Pattern**: Stricter security in production

```typescript
// S3 bucket public access
const blockPublicAccess = environment === 'prod'
  ? cdk.aws_s3.BlockPublicAccess.BLOCK_ALL
  : new cdk.aws_s3.BlockPublicAccess({
      blockPublicAcls: false,
      ignorePublicAcls: false,
      blockPublicPolicy: false,
      restrictPublicBuckets: false,
    });

// Resource removal policies
const removalPolicy = environment === 'prod'
  ? cdk.RemovalPolicy.RETAIN
  : cdk.RemovalPolicy.DESTROY;
```

**Benefits**: Security by environment, cost-effective
**Replicate**: Always - adapt to your service's data sensitivity

### 4. Log Retention by Environment

**Pattern**: Environment-specific log retention

```typescript
const logRetentionDays = {
  dev: 7,
  staging: 30,
  prod: 90,
}[environment];
```

**Benefits**: Cost optimization, compliance requirements
**Replicate**: Always - adjust retention periods based on your needs

### 5. Resource Removal Policies

**Pattern**: Environment-based retention policies

```typescript
const removalPolicy = environment === 'prod'
  ? cdk.RemovalPolicy.RETAIN
  : cdk.RemovalPolicy.DESTROY;

const autoDeleteObjects = environment === 'prod' ? false : true;
```

**Benefits**: Cost control in dev, data protection in prod
**Replicate**: Always - this is a standard pattern

## Context-Dependent Best Practices

### 6. API Gateway Throttling Configuration

**Pattern**: Environment-specific rate limits

```typescript
const throttleConfig = {
  dev: { rateLimit: 100, burstLimit: 200 },
  staging: { rateLimit: 500, burstLimit: 1000 },
  prod: { rateLimit: 2000, burstLimit: 5000 },
}[environment];
```

**Decision Framework**:
- **Use when**: Your service has external API endpoints
- **Skip when**: Internal-only services or very low traffic
- **Adjust based on**: Expected load, cost constraints, SLA requirements

### 7. Service-Specific IAM Roles

**Pattern**: Dedicated roles for external services

```typescript
const externalServiceRole = new iam.Role(this, 'ExternalServiceRole', {
  roleName: `my-service-${environment}-external-access`,
  assumedBy: new iam.ServicePrincipal('external-service.amazonaws.com'),
});
// Grant minimal required permissions
```

**Decision Framework**:
- **Use when**: Integrating with external AWS services (Transcribe, Comprehend, etc.)
- **Skip when**: Only using basic AWS services (S3, DynamoDB) with Lambda execution role
- **Always**: Follow principle of least privilege

### 8. CloudFront Price Class Optimization

**Pattern**: Use appropriate price class for your audience

```typescript
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US/Europe only
  // vs PRICE_CLASS_ALL for global coverage
});
```

**Decision Framework**:
- **PRICE_CLASS_100**: US/Europe users only, cost-optimized
- **PRICE_CLASS_ALL**: Global users, higher cost but better performance
- **Skip entirely**: Internal-only services or very low traffic

## Service-Specific Patterns

### 9. DynamoDB GSI Design for Idempotency

**Pattern**: Global Secondary Index for idempotency key lookups

```typescript
table.addGlobalSecondaryIndex({
  indexName: 'idempotency_key',
  partitionKey: { name: 'idempotency_key', type: cdk.aws_dynamodb.AttributeType.STRING },
  projectionType: cdk.aws_dynamodb.ProjectionType.ALL,
});
```

**Decision Framework**:
- **Use when**: Your service needs idempotency (most APIs should)
- **Skip when**: Stateless services or very simple CRUD operations
- **Consider**: Cost of GSI vs. benefits of idempotency

### 10. Step Functions Choice State Patterns

**Pattern**: Conditional execution with `afterwards()` chaining

```typescript
const maybeProcess = new sfn.Choice(this, 'MaybeProcess')
  .when(sfn.Condition.booleanEquals('$.plan.needProcessing', true), processTask)
  .otherwise(skipTask);

const afterProcess = maybeProcess.afterwards();
afterProcess.next(nextTask);
```

**Decision Framework**:
- **Use when**: Complex, conditional workflows with multiple paths
- **Skip when**: Simple linear workflows or single-purpose services
- **Consider**: Step Functions cost vs. Lambda orchestration complexity

### 11. Environment Variable Injection

**Pattern**: Runtime environment variables for external service ARNs

```typescript
lambda.addEnvironment('EXTERNAL_SERVICE_ROLE_ARN', externalRole.roleArn);
lambda.addEnvironment('EXTERNAL_SERVICE_ENDPOINT', externalEndpoint);
```

**Decision Framework**:
- **Use when**: Integrating with external services or need runtime configuration
- **Skip when**: All configuration can be determined at build time
- **Always**: Use for external service ARNs and environment-specific endpoints

### 12. Step Functions State Machine Naming

**Pattern**: `{service}-{environment}-{version}`

```typescript
const stateMachine = new sfn.StateMachine(this, 'StateMachine', {
  stateMachineName: `my-service-${environment}-v1`,
});
```

**Decision Framework**:
- **Use when**: Using Step Functions for workflow orchestration
- **Skip when**: Simple Lambda-only services
- **Consider**: Version management strategy for state machines

## Decision Framework Summary

### Always Implement
1. Environment-specific configuration management
2. Resource naming conventions
3. Environment-based security policies
4. Log retention by environment
5. Resource removal policies

### Evaluate Based on Service Type
- **API Services**: Throttling, idempotency patterns
- **Global Services**: CloudFront configuration
- **External Integrations**: Service-specific IAM roles
- **Complex Workflows**: Step Functions patterns

### Skip Unless Needed
- Step Functions (unless complex workflows)
- CloudFront (unless global users)
- GSI for idempotency (unless idempotency required)

## Implementation Checklist

- [ ] Set up environment-specific configuration files
- [ ] Implement resource naming conventions
- [ ] Configure environment-based security policies
- [ ] Set appropriate log retention per environment
- [ ] Configure resource removal policies
- [ ] Evaluate API throttling needs
- [ ] Assess external service integration requirements
- [ ] Determine global reach for CDN configuration
- [ ] Evaluate idempotency requirements
- [ ] Consider workflow complexity for Step Functions

## Anti-Patterns to Avoid

- **Hardcoded environment values**: Use configuration management
- **Overly permissive IAM policies**: Follow least privilege
- **Same security policies across environments**: Differentiate by environment
- **Unnecessary complexity**: Start simple, add complexity only when needed
- **Ignoring cost implications**: Consider cost in design decisions
