# Aviary Shared Authentication Library

Platform-wide shared API key authentication library for all Aviary microservices with backwards compatibility for legacy authentication methods.

## Overview

This library provides a unified authentication mechanism that:
- Supports new shared API key authentication (`X-API-Key` header)
- Maintains backwards compatibility with legacy API Gateway keys
- Maintains backwards compatibility with legacy Bearer tokens
- Provides deprecation warnings for legacy authentication methods
- Follows RFC 8594 deprecation standards

## Installation

```bash
npm install @aviary/auth
```

## Usage

### Basic Authorization

```typescript
import { authorizeRequest, addDeprecationHeaders } from '@aviary/auth';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // Authorize the request
  const authResult = await authorizeRequest(event, '/aviary/shared/api-key');

  if (!authResult.authorized) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // Add deprecation headers if using legacy auth
  let headers = { 'Content-Type': 'application/json' };
  headers = addDeprecationHeaders(headers, authResult, '2025-12-31T23:59:59Z');

  // Process the request
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: 'Success' }),
  };
}
```

### Service-Specific Secret Paths

Each service should use its own secret path in Secrets Manager:

```typescript
// Shared key (recommended)
await authorizeRequest(event, '/aviary/shared/api-key');

// Service-specific key (for migration period)
await authorizeRequest(event, '/aviary/magpie/service');
await authorizeRequest(event, '/aviary/skylark/service');
```

## Authentication Priority

The library attempts authentication methods in this order:

1. **Shared Key** (Primary): `X-API-Key` or `x-api-key` header
2. **API Gateway Key** (Legacy): `requestContext.identity.apiKeyId`
3. **Bearer Token** (Legacy): `Authorization: Bearer <token>` header

If shared key authentication succeeds, legacy methods are not attempted.

## API Reference

### `authorizeRequest(event, secretPath)`

Authorizes an API Gateway request using multiple authentication methods.

**Parameters:**
- `event: APIGatewayProxyEvent` - The API Gateway proxy event
- `secretPath: string` - AWS Secrets Manager path for the expected key/token

**Returns:** `Promise<AuthResult>`

```typescript
interface AuthResult {
  authorized: boolean;
  method: 'shared-key' | 'legacy-api-gateway' | 'legacy-bearer' | 'none';
  deprecation?: string;
}
```

### `addDeprecationHeaders(headers, authResult, sunsetDate)`

Adds RFC 8594 deprecation headers when legacy authentication is used.

**Parameters:**
- `headers: Record<string, string>` - Existing response headers
- `authResult: AuthResult` - Result from `authorizeRequest()`
- `sunsetDate: string` - ISO 8601 date when legacy auth will be removed

**Returns:** `Record<string, string>` - Updated headers object

**Headers Added:**
- `Sunset` - RFC 7231 date format (e.g., "Sat, 31 Dec 2025 23:59:59 GMT")
- `Deprecation` - "true"
- `Link` - Documentation URL with `rel="deprecation"`
- `X-Auth-Method` - Authentication method used (for debugging)

## Migration Guide

### Week 1-2: Add Dual Auth Support

1. Install the library in your service
2. Update your Lambda handler to use `authorizeRequest()`
3. Add deprecation headers to responses
4. Deploy and test with both old and new auth methods

### Week 3-4: Update Clients

1. Update MCP tools to use `X-API-Key` header
2. Update service-to-service calls to use shared key
3. Monitor CloudWatch for legacy auth usage

### Week 5-6: Monitor Migration

1. Check deprecation header metrics
2. Identify remaining clients using legacy auth
3. Coordinate migration for remaining clients

### Week 7-8: Remove Legacy Auth

1. Update library to remove legacy auth support
2. Redeploy all services with new version
3. Verify no legacy auth attempts in logs

## Development

### Running Tests

```bash
npm test              # Run tests once
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

### Building

```bash
npm run build        # Compile TypeScript
npm run type-check   # Type check without emitting
```

## TDD Workflow

This library was developed using strict Test-Driven Development:

1. **RED Phase** (Week 1-2): Write failing tests first
2. **GREEN Phase** (Week 1-2): Implement minimal code to pass tests
3. **REFACTOR Phase** (Week 1-2): Optimize and clean up implementation

Current Status: **RED Phase** ✅

- 30+ comprehensive tests written
- All tests currently failing (as expected)
- Stub implementations in place
- Ready for GREEN phase implementation

## License

UNLICENSED - Internal Aviary use only
