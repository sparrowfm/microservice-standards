# RED Phase Summary - Aviary Shared Auth Library

**Status:** ✅ RED Phase Complete
**Date:** November 15, 2025
**TDD Methodology:** Week 1-2, Phase 1.1 of 8-week auth refactor plan

## Overview

Successfully completed the RED phase of Test-Driven Development for the Aviary platform-wide shared authentication library. All test files written, stub implementations created, and tests run to confirm failures.

## Test Statistics

- **Total Tests:** 34
- **Failing Tests:** 19 (expected - these test success cases)
- **Passing Tests:** 15 (expected - these test failure cases that match stub behavior)
- **Test Files:** 2
  - `tests/authorize.test.ts` - 24 tests
  - `tests/deprecation.test.ts` - 10 tests

## Test Coverage Breakdown

### authorize.test.ts (24 tests)

#### Shared Key Authentication (7 tests)
1. ✅ Valid shared key with `X-API-Key` header → authorized
2. ✅ Valid shared key with `x-api-key` header (lowercase) → authorized
3. ✅ Invalid shared key → not authorized
4. ✅ Missing shared key → falls back to legacy auth
5. ✅ Empty string shared key → not authorized
6. ✅ Whitespace-only shared key → not authorized
7. ✅ Shared key with leading/trailing whitespace → trimmed and validated

#### API Gateway Fallback (3 tests)
8. ✅ Valid API Gateway key → authorized with deprecation warning
9. ✅ API Gateway fallback when shared key invalid → works
10. ✅ Missing API Gateway key → falls back to Bearer

#### Bearer Token Fallback (6 tests)
11. ✅ Valid Bearer token → authorized with deprecation warning
12. ✅ Bearer token with lowercase `authorization` header → works
13. ✅ Bearer token with uppercase `AUTHORIZATION` header → works
14. ✅ Malformed Bearer header (no "Bearer " prefix) → not authorized
15. ✅ Empty Bearer token → not authorized
16. ✅ Bearer token when shared key and API Gateway fail → works

#### Edge Cases (5 tests)
17. ✅ No authentication provided → not authorized, method='none'
18. ✅ All auth methods invalid → not authorized, method='none'
19. ✅ Secrets Manager failure (secret not found) → not authorized
20. ✅ Secrets Manager timeout → not authorized
21. ✅ Multiple headers present → shared key wins priority

#### Environment & Configuration (3 tests)
22. ✅ Missing secret path → not authorized
23. ✅ Invalid secret path format → not authorized
24. ✅ Secret exists but doesn't contain expected key → not authorized

### deprecation.test.ts (10 tests)

#### No Deprecation (1 test)
1. ✅ No deprecation in auth result → headers unchanged

#### Deprecation Header Addition (4 tests)
2. ✅ Deprecation present → adds Sunset header in RFC 7231 format
3. ✅ Deprecation present → adds Deprecation: true header
4. ✅ Deprecation present → adds Link header with rel="deprecation"
5. ✅ Deprecation present → adds X-Auth-Method header

#### Date Conversion (1 test)
6. ✅ ISO sunset date → converted to RFC 7231 format correctly

#### Header Preservation (3 tests)
7. ✅ Existing headers preserved → original headers not lost
8. ✅ Multiple calls → headers don't duplicate
9. ✅ Empty headers object → creates new headers

#### Auth Method Matching (1 test)
10. ✅ Auth method in headers → matches auth result method

## File Structure Created

```
microservice-standards/auth/
├── src/
│   ├── authorize.ts        # Stub authorizeRequest() - always returns not authorized
│   ├── deprecation.ts      # Stub addDeprecationHeaders() - returns headers unchanged
│   └── index.ts           # Exports both functions
├── tests/
│   ├── authorize.test.ts   # 24 comprehensive authorization tests
│   └── deprecation.test.ts # 10 deprecation header tests
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vitest.config.ts       # Vitest test configuration
├── README.md             # Library documentation
└── RED_PHASE_SUMMARY.md  # This file
```

## Dependencies Installed

### Production Dependencies
- `@aws-sdk/client-secrets-manager` ^3.600.0 - AWS Secrets Manager integration
- `aws-lambda` ^1.0.7 - Lambda type definitions

### Development Dependencies
- `typescript` ^5.4.5 - TypeScript compiler
- `vitest` ^1.6.0 - Test framework
- `@vitest/coverage-v8` ^1.6.0 - Coverage reporting
- `@types/aws-lambda` ^8.10.145 - Lambda type definitions
- `@types/node` ^20.14.0 - Node.js type definitions
- `eslint` ^8.57.0 - Code linting

## Stub Implementations

### authorize.ts
```typescript
export async function authorizeRequest(
  event: APIGatewayProxyEvent,
  secretPath: string
): Promise<AuthResult> {
  // STUB: Always returns not authorized
  return {
    authorized: false,
    method: 'none',
  };
}
```

### deprecation.ts
```typescript
export function addDeprecationHeaders(
  headers: Record<string, string>,
  authResult: AuthResult,
  sunsetDate: string
): Record<string, string> {
  // STUB: Returns headers unchanged
  return headers;
}
```

## Why Some Tests Pass

15 tests pass because they test failure scenarios:
- "should not authorize invalid shared key" - expects `authorized: false` ✅
- "should return not authorized when no authentication provided" - expects `method: 'none'` ✅
- "should not authorize empty Bearer token" - expects `authorized: false` ✅
- etc.

19 tests fail because they test success scenarios:
- "should authorize valid shared key" - expects `authorized: true` ❌ (stub returns false)
- "should add Sunset header when deprecation present" - expects header ❌ (stub returns unchanged)
- etc.

This is **exactly the expected behavior for RED phase** - we've written comprehensive tests that define the requirements, and the stub implementations intentionally don't meet them yet.

## Test Failure Examples

### Authorization Test Failure
```
FAIL  tests/authorize.test.ts > should authorize valid shared key with X-API-Key header
AssertionError: expected false to be true // Object.is equality

- Expected: true
+ Received: false
```

### Deprecation Test Failure
```
FAIL  tests/deprecation.test.ts > should add Deprecation: true header when deprecation present
AssertionError: expected undefined to be 'true' // Object.is equality

- Expected: "true"
+ Received: undefined
```

## Next Steps (GREEN Phase)

Ready to implement functionality to make all 19 failing tests pass:

### 1. authorizeRequest() Implementation
- [ ] Integrate AWS Secrets Manager client
- [ ] Implement shared key authentication (X-API-Key header)
- [ ] Implement API Gateway fallback (requestContext.identity.apiKeyId)
- [ ] Implement Bearer token fallback (Authorization header)
- [ ] Add proper error handling for Secrets Manager failures
- [ ] Add input validation and sanitization
- [ ] Add deprecation warnings for legacy methods

### 2. addDeprecationHeaders() Implementation
- [ ] Check for deprecation in auth result
- [ ] Convert ISO 8601 date to RFC 7231 format
- [ ] Add Sunset header
- [ ] Add Deprecation: true header
- [ ] Add Link header with documentation URL
- [ ] Add X-Auth-Method header for debugging
- [ ] Preserve existing headers

### 3. Integration Testing
- [ ] Test with real AWS Secrets Manager (optional)
- [ ] Test all authentication paths work correctly
- [ ] Verify backwards compatibility with legacy auth
- [ ] Verify deprecation headers follow RFC 8594

## Success Criteria Met ✅

- [x] 30+ comprehensive tests written (achieved 34)
- [x] Tests cover happy path, edge cases, and error scenarios
- [x] Tests use mocks for AWS services (no real AWS calls)
- [x] All expected tests fail (19 failing tests for success cases)
- [x] Code is typed correctly (TypeScript compiles successfully)
- [x] Test output shows clear failure messages
- [x] Directory structure created
- [x] Dependencies installed
- [x] README documentation complete

## Commands to Run Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (for GREEN phase development)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Type check
npm run type-check

# Build library
npm run build
```

## TDD Workflow Progress

- [x] **RED Phase (Week 1-2):** Write failing tests ← **YOU ARE HERE**
- [ ] **GREEN Phase (Week 1-2):** Implement minimal code to pass tests
- [ ] **REFACTOR Phase (Week 1-2):** Optimize and clean up implementation
- [ ] **Integration (Week 3-4):** Deploy to all 8 microservices
- [ ] **Migration (Week 5-6):** Update clients to use new auth
- [ ] **Cleanup (Week 7-8):** Remove legacy auth support

---

**Ready for GREEN Phase implementation!** 🟢

All tests written, all expected failures confirmed, stub implementations in place. The next step is to implement `authorizeRequest()` and `addDeprecationHeaders()` to make the 19 failing tests pass while keeping the 15 passing tests passing.
