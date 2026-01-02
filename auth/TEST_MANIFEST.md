# Test Manifest - Complete Test List

**Total Tests:** 34 (19 failing ❌, 15 passing ✅)

## authorize.test.ts (24 tests)

### Shared Key Authentication - Primary (7 tests)
1. ❌ should authorize valid shared key with X-API-Key header
2. ❌ should authorize valid shared key with lowercase x-api-key header
3. ✅ should not authorize invalid shared key
4. ✅ should fall back to legacy auth when shared key is missing
5. ✅ should not authorize empty string shared key
6. ✅ should not authorize whitespace-only shared key
7. ❌ should trim and validate shared key with leading/trailing whitespace

### API Gateway Fallback Authentication (3 tests)
8. ❌ should authorize valid API Gateway key with deprecation warning
9. ❌ should use API Gateway fallback when shared key is invalid
10. ✅ should fall back to Bearer when API Gateway key is missing

### Bearer Token Fallback Authentication (6 tests)
11. ❌ should authorize valid Bearer token with deprecation warning
12. ❌ should handle Bearer token with lowercase authorization header
13. ❌ should handle Bearer token with uppercase AUTHORIZATION header
14. ✅ should not authorize malformed Bearer header without Bearer prefix
15. ✅ should not authorize empty Bearer token
16. ❌ should use Bearer token when shared key and API Gateway fail

### Edge Cases (5 tests)
17. ✅ should return not authorized when no authentication provided
18. ✅ should return not authorized when all auth methods are invalid
19. ✅ should handle Secrets Manager failure gracefully
20. ✅ should handle Secrets Manager timeout gracefully
21. ❌ should prioritize shared key when multiple headers present

### Environment & Configuration (3 tests)
22. ✅ should handle missing secret path
23. ✅ should handle invalid secret path format
24. ✅ should handle secret exists but does not contain expected key

## deprecation.test.ts (10 tests)

### No Deprecation Scenarios (1 test)
25. ✅ should not modify headers when no deprecation in auth result

### Deprecation Header Addition (4 tests)
26. ❌ should add Sunset header in RFC 7231 format when deprecation present
27. ❌ should add Deprecation: true header when deprecation present
28. ❌ should add Link header with rel="deprecation" when deprecation present
29. ❌ should add X-Auth-Method header when deprecation present

### ISO to RFC 7231 Date Conversion (1 test)
30. ❌ should convert ISO sunset date to RFC 7231 format correctly

### Existing Header Preservation (3 tests)
31. ❌ should preserve existing headers when adding deprecation headers
32. ❌ should not duplicate headers on multiple calls
33. ❌ should handle empty headers object

### Auth Method in Headers (1 test)
34. ❌ should set X-Auth-Method to match auth result method

---

## Test Status Summary

### Passing Tests (15) - All Expected ✅
These tests verify **failure scenarios** and match the stub implementation:
- Tests 3-6: Invalid/missing shared key scenarios
- Test 10: Missing API Gateway key fallback
- Tests 14-15: Malformed/empty Bearer token
- Tests 17-24: Edge cases and error handling
- Test 25: No deprecation scenario

### Failing Tests (19) - All Expected ❌
These tests verify **success scenarios** that the stub doesn't implement yet:
- Tests 1-2, 7: Valid shared key authentication
- Tests 8-9: API Gateway fallback with valid key
- Tests 11-13, 16: Bearer token authentication
- Test 21: Priority when multiple auth methods present
- Tests 26-34: Deprecation header addition

## Test Organization

```
tests/
├── authorize.test.ts (24 tests)
│   ├── Shared Key Authentication (Primary) - 7 tests
│   │   ├── Valid cases (3 tests) ❌
│   │   └── Invalid cases (4 tests) ✅
│   ├── API Gateway Fallback - 3 tests
│   │   ├── Valid cases (2 tests) ❌
│   │   └── Invalid cases (1 test) ✅
│   ├── Bearer Token Fallback - 6 tests
│   │   ├── Valid cases (4 tests) ❌
│   │   └── Invalid cases (2 tests) ✅
│   ├── Edge Cases - 5 tests
│   │   ├── Priority test (1 test) ❌
│   │   └── Error handling (4 tests) ✅
│   └── Environment & Configuration - 3 tests ✅
│
└── deprecation.test.ts (10 tests)
    ├── No Deprecation - 1 test ✅
    ├── Deprecation Header Addition - 4 tests ❌
    ├── Date Conversion - 1 test ❌
    ├── Header Preservation - 3 tests ❌
    └── Auth Method Matching - 1 test ❌
```

## Test Failure Patterns

### Pattern 1: Authorization Failures
```
Expected: result.authorized = true
Received: result.authorized = false (stub)
```
**Affected Tests:** 1, 2, 7, 8, 9, 11, 12, 13, 16, 21

### Pattern 2: Method Type Failures
```
Expected: result.method = 'shared-key' | 'legacy-api-gateway' | 'legacy-bearer'
Received: result.method = 'none' (stub)
```
**Affected Tests:** 1, 2, 7, 8, 9, 11, 12, 13, 16, 21

### Pattern 3: Deprecation Header Failures
```
Expected: headers contain RFC 8594 deprecation headers
Received: headers unchanged (stub)
```
**Affected Tests:** 26, 27, 28, 29, 30, 31, 32, 33, 34

## Coverage by Authentication Method

### Shared Key (X-API-Key)
- **Tests:** 1, 2, 3, 4, 5, 6, 7, 21
- **Coverage:**
  - ✅ Valid key with different casings
  - ✅ Invalid key
  - ✅ Missing key
  - ✅ Empty/whitespace key
  - ✅ Trimming behavior
  - ✅ Priority over other methods

### API Gateway (requestContext.identity.apiKeyId)
- **Tests:** 8, 9, 10
- **Coverage:**
  - ✅ Valid API Gateway key
  - ✅ Fallback when shared key invalid
  - ✅ Fallback to Bearer when missing
  - ✅ Deprecation warning

### Bearer Token (Authorization header)
- **Tests:** 11, 12, 13, 14, 15, 16
- **Coverage:**
  - ✅ Valid Bearer token
  - ✅ Case-insensitive header name
  - ✅ Malformed header
  - ✅ Empty token
  - ✅ Fallback chain
  - ✅ Deprecation warning

### Edge Cases
- **Tests:** 17, 18, 19, 20, 21, 22, 23, 24
- **Coverage:**
  - ✅ No authentication provided
  - ✅ All methods invalid
  - ✅ Secrets Manager errors
  - ✅ Invalid configuration
  - ✅ Priority ordering

### Deprecation Headers (RFC 8594)
- **Tests:** 25, 26, 27, 28, 29, 30, 31, 32, 33, 34
- **Coverage:**
  - ✅ No deprecation case
  - ✅ All required headers (Sunset, Deprecation, Link, X-Auth-Method)
  - ✅ Date format conversion
  - ✅ Header preservation
  - ✅ No duplication

## Expected Implementation Requirements

### authorizeRequest() Must Implement:
1. **Shared Key Validation** (Tests 1-7, 21)
   - Check X-API-Key and x-api-key headers
   - Fetch secret from Secrets Manager
   - Compare trimmed values
   - Return `{ authorized: true, method: 'shared-key' }`

2. **API Gateway Fallback** (Tests 8-10)
   - Check requestContext.identity.apiKeyId
   - Return `{ authorized: true, method: 'legacy-api-gateway', deprecation: '...' }`

3. **Bearer Token Fallback** (Tests 11-16)
   - Check Authorization header (case-insensitive)
   - Extract token after "Bearer "
   - Fetch secret from Secrets Manager
   - Return `{ authorized: true, method: 'legacy-bearer', deprecation: '...' }`

4. **Error Handling** (Tests 17-24)
   - Handle missing secrets gracefully
   - Handle Secrets Manager errors
   - Validate input parameters
   - Return `{ authorized: false, method: 'none' }`

### addDeprecationHeaders() Must Implement:
1. **Check for Deprecation** (Test 25)
   - Return unchanged if no deprecation

2. **Add Headers** (Tests 26-29)
   - Sunset: Convert ISO to RFC 7231
   - Deprecation: "true"
   - Link: `<https://docs.chirpy.studio/auth-migration>; rel="deprecation"`
   - X-Auth-Method: From authResult.method

3. **Date Conversion** (Test 30)
   - ISO 8601 → RFC 7231 format
   - Example: "2025-06-15T14:30:00Z" → "Sun, 15 Jun 2025 14:30:00 GMT"

4. **Preserve Headers** (Tests 31-33)
   - Keep existing headers
   - Don't duplicate on multiple calls
   - Handle empty headers object

---

## Quick Reference

**Run all tests:**
```bash
npm test
```

**Run specific test file:**
```bash
npm test tests/authorize.test.ts
npm test tests/deprecation.test.ts
```

**Run with verbose output:**
```bash
npm test -- --reporter=verbose
```

**Run in watch mode:**
```bash
npm run test:watch
```

**Generate coverage:**
```bash
npm run test:coverage
```

---

**Created:** November 15, 2025
**Status:** RED Phase Complete - Ready for GREEN Phase
**Next:** Implement functionality to make all 19 failing tests pass
