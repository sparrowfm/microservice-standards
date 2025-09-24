# API Standards

## REST API Design

### Endpoint Naming
```
GET  /v1/resources          # List resources
POST /v1/resources          # Create resource
GET  /v1/resources/{id}     # Get specific resource
PUT  /v1/resources/{id}     # Update resource
DELETE /v1/resources/{id}   # Delete resource
```

### Response Format
```json
{
  "success": true,
  "data": {
    "id": "resource_01XXXXX",
    "status": "completed"
  },
  "meta": {
    "timestamp": "2023-09-20T10:30:00Z",
    "version": "v1.0.0"
  }
}
```

## Webhook Payload Standards

Design webhook payloads with a small, stable envelope and an optional heavy "blob". Keep it simple (KISS) and evolve additively (YAGNI until needed).

### Envelope
- Required top-level fields:
  - `event_type`: Machine-readable event name (e.g., `job.completed`)
  - `version`: Schema version for the envelope (string)
  - `event_id`: Unique ID (UUID/ULID); use as idempotency key
  - `subject_id`: ID the event is about (e.g., `job_id`)
  - `status`: High-level state (e.g., `completed` | `failed`)
  - `source`: Service name emitting the event
  - `occurred_at`: ISO-8601 timestamp when the event happened
  - `delivered_at`: ISO-8601 timestamp when delivered to the receiver
  - `attempt`: Delivery attempt count (starts at 1)
  - `correlation_id`: Request/trace correlation identifier
  - `artifacts`: Object with public URLs to relevant resources (CDN where applicable)
  - `error`: Present only on failures: `{ code, message, details? }`

### Blob (primary data)
- Use a single field `blob` for heavy data; prefer a JSON string to avoid double-parsing issues across languages.
- Include metadata for integrity and evolution:
  - `blob_schema_version`: Version of the blob's internal schema
  - `blob_checksum`: `sha256:<hex>` of the uncompressed blob
  - `blob_size`: Uncompressed size in bytes
  - `blob_encoding`: Typically `utf-8`; if compressed, set `gzip+base64`
  - `blob_truncated`: Boolean flag if the inline blob is truncated
- Provide a `resource_url` (and specific artifact URLs) so consumers can fetch the full content if blob is omitted or truncated.

### Size and transport
- Target payloads under ~1–2 MB. For larger data, prefer providing `resource_url` and include `blob` only when practical.
- If compressing, base64-encode and record `blob_encoding`, `blob_size`, and `blob_checksum` for verification.

### Security
- Sign the raw HTTP body using HMAC (e.g., SHA-256) and include headers:
  - `X-Signature`: Hex HMAC of the raw body
  - `X-Timestamp`: Sender timestamp used in signature
- Receivers should verify signature, enforce a reasonable clock skew window, and reject replays. Always use HTTPS.

### Reliability and retries
- Treat any 2xx as success; retry non-2xx with exponential backoff.
- Document retry window and provide a replay mechanism.
- Receivers must be idempotent using `event_id`.

### Observability
- Include `traceparent` (W3C) and `X-Request-Id` headers to enable cross-system tracing.

### Minimal example
```json
{
  "event_type": "job.completed",
  "version": "1.0",
  "event_id": "01J123ABCDEF7890GHJKL12345",
  "subject_id": "job_01J123ABCDEF7890GHJKL12345",
  "status": "completed",
  "source": "your-service",
  "occurred_at": "2025-09-23T06:12:38.953Z",
  "delivered_at": "2025-09-23T06:12:39.120Z",
  "attempt": 1,
  "correlation_id": "req_abc123",
  "artifacts": {
    "resource_url": "https://cdn.example.com/jobs/job_.../result.json"
  },
  "blob_schema_version": "1.0",
  "blob_checksum": "sha256:5c1df0...9af2",
  "blob_size": 74231,
  "blob_encoding": "utf-8",
  "blob_truncated": false,
  "blob": "{ \"...\": \"full JSON serialized as a single string\" }",
  "error": null
}
```

This structure provides a stable contract for routing, idempotency, and tracing while allowing large, evolving data to be carried inline or via URLs.

## Lambda Architecture

### Runtime Selection
- **Node.js**: Use `NODEJS_18_X` or `NODEJS_20_X` for JavaScript/TypeScript services
- **Python**: Use `PYTHON_3_11` or `PYTHON_3_12` for Python services
- **Java**: Use `JAVA_17` or `JAVA_21` for Java services
- Avoid deprecated runtimes; check AWS Lambda runtime support matrix

### Architecture Selection
- **Default**: x86_64 (Intel) - compatible with all libraries and runtimes
- **ARM64 (Graviton2/3)**: 10-20% better price/performance for CPU-bound workloads
  - Use for: compute-intensive tasks, data processing, ML inference
  - Avoid for: functions with x86-specific dependencies or libraries

### CDK Configuration
```typescript
// Default x86_64
const fn = new lambda.Function(this, 'MyFunction', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  // architecture: lambda.Architecture.X86_64, // default
});

// ARM64 for better price/performance
const fn = new lambda.Function(this, 'MyFunction', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  architecture: lambda.Architecture.ARM_64,
});
```

### Memory and Timeout Guidelines
- **Memory**: Start with 256MB, scale up based on actual usage
- **Timeout**: Set based on expected duration + buffer (API Gateway max: 29s)
- **Reserved Concurrency**: Only set if you need to limit concurrent executions

### Environment Variables
- Use environment variables for configuration, not hardcoded values
- Include: `ENVIRONMENT`, service-specific config, external service URLs
- Avoid: secrets (use AWS Secrets Manager or Parameter Store)

### Best Practices
- Keep functions small and focused (single responsibility)
- Use provisioned concurrency only for predictable, high-traffic functions
- Monitor cold starts and optimize initialization code
- Use layers for shared dependencies across multiple functions

### Error Responses
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input provided",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  },
  "meta": {
    "timestamp": "2023-09-20T10:30:00Z",
    "request_id": "req_01XXXXX"
  }
}
```

### Standard Error Codes
- `VALIDATION_ERROR` - Invalid input data
- `AUTHENTICATION_ERROR` - Invalid or missing credentials
- `AUTHORIZATION_ERROR` - Insufficient permissions
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server-side error
- `SERVICE_UNAVAILABLE` - Temporary service issue

## OpenAPI Documentation

### Required Fields
- Title and description
- Version number
- Contact information
- Authentication schemes
- Example requests/responses

### Schema Validation
```bash
# Validate OpenAPI spec
npm run validate:openapi

# Generate documentation
npm run docs:build
```

## Versioning Strategy

### API Versioning
- Use semantic versioning (e.g., v1.0.0)
- Include version in URL path (`/v1/`)
- Maintain backward compatibility within major versions

### Breaking Changes
- Increment major version
- Provide migration guide
- Support previous version for transition period

## Authentication

### API Keys
```bash
Authorization: Bearer your-api-key
```

### Rate Limiting
- Use standard HTTP headers
- Implement exponential backoff
- Provide clear error messages

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 60 seconds.",
    "retry_after": 60
  }
}
```