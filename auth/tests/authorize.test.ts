import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { authorizeRequest } from '../src/authorize';

// Mock AWS Secrets Manager
vi.mock('@aws-sdk/client-secrets-manager', () => {
  // Mock secret responses
  const mockSecretResponses: Record<string, Record<string, string>> = {
    '/aviary/shared/api-key': {
      AVIARY_SHARED_API_KEY: 'valid-shared-key-12345',
    },
    '/aviary/test/custom-key': {
      CUSTOM_KEY_NAME: 'custom-key-value-abc',
    },
  };

  const mockSend = vi.fn((command: any) => {
    const secretId = command.input?.SecretId;
    const secrets = mockSecretResponses[secretId];

    if (!secrets) {
      return Promise.reject(new Error(`Secret not found: ${secretId}`));
    }

    return Promise.resolve({
      SecretString: JSON.stringify(secrets),
    });
  });

  return {
    SecretsManagerClient: vi.fn(() => ({
      send: mockSend,
    })),
    GetSecretValueCommand: vi.fn((input) => ({ input })),
  };
});

describe('authorizeRequest', () => {
  let mockEvent: Partial<APIGatewayProxyEvent>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEvent = {
      headers: {},
      requestContext: {} as any,
    };
  });

  // ============================================================================
  // SHARED KEY AUTHENTICATION TESTS
  // ============================================================================

  describe('Shared Key Authentication', () => {
    it('should authorize valid shared key with X-API-Key header', async () => {
      mockEvent.headers = { 'X-API-Key': 'valid-shared-key-12345' };

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        '/aviary/shared/api-key'
      );

      expect(result.authorized).toBe(true);
      expect(result.method).toBe('shared-key');
    });

    it('should authorize valid shared key with lowercase x-api-key header', async () => {
      mockEvent.headers = { 'x-api-key': 'valid-shared-key-12345' };

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        '/aviary/shared/api-key'
      );

      expect(result.authorized).toBe(true);
      expect(result.method).toBe('shared-key');
    });

    it('should not authorize invalid shared key', async () => {
      mockEvent.headers = { 'X-API-Key': 'invalid-key' };

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        '/aviary/shared/api-key'
      );

      expect(result.authorized).toBe(false);
      expect(result.method).toBe('none');
    });

    it('should not authorize when X-API-Key header is missing', async () => {
      mockEvent.headers = {};

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        '/aviary/shared/api-key'
      );

      expect(result.authorized).toBe(false);
      expect(result.method).toBe('none');
    });

    it('should not authorize empty string shared key', async () => {
      mockEvent.headers = { 'X-API-Key': '' };

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        '/aviary/shared/api-key'
      );

      expect(result.authorized).toBe(false);
      expect(result.method).toBe('none');
    });

    it('should not authorize whitespace-only shared key', async () => {
      mockEvent.headers = { 'X-API-Key': '   \t\n   ' };

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        '/aviary/shared/api-key'
      );

      expect(result.authorized).toBe(false);
      expect(result.method).toBe('none');
    });

    it('should trim and validate shared key with leading/trailing whitespace', async () => {
      mockEvent.headers = { 'X-API-Key': '  valid-shared-key-12345  ' };

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        '/aviary/shared/api-key'
      );

      expect(result.authorized).toBe(true);
      expect(result.method).toBe('shared-key');
    });

    it('should support custom key names in options', async () => {
      mockEvent.headers = { 'X-API-Key': 'custom-key-value-abc' };

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        '/aviary/test/custom-key',
        { sharedKeyName: 'CUSTOM_KEY_NAME' }
      );

      expect(result.authorized).toBe(true);
      expect(result.method).toBe('shared-key');
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle Secrets Manager failure gracefully', async () => {
      mockEvent.headers = { 'X-API-Key': 'some-key' };

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        '/invalid/secret/path'
      );

      expect(result.authorized).toBe(false);
      expect(result.method).toBe('none');
    });

    it('should handle missing secret path', async () => {
      mockEvent.headers = { 'X-API-Key': 'some-key' };

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        ''
      );

      expect(result.authorized).toBe(false);
      expect(result.method).toBe('none');
    });

    it('should handle invalid secret path format', async () => {
      mockEvent.headers = { 'X-API-Key': 'some-key' };

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        'invalid-path-no-slashes'
      );

      expect(result.authorized).toBe(false);
      expect(result.method).toBe('none');
    });

    it('should handle secret exists but does not contain expected key', async () => {
      mockEvent.headers = { 'X-API-Key': 'some-key' };

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        '/aviary/empty/secret'
      );

      expect(result.authorized).toBe(false);
      expect(result.method).toBe('none');
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should return not authorized when no authentication provided', async () => {
      mockEvent.headers = {};
      mockEvent.requestContext = { identity: {} } as any;

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        '/aviary/shared/api-key'
      );

      expect(result.authorized).toBe(false);
      expect(result.method).toBe('none');
    });

    it('should ignore Bearer token headers (not supported)', async () => {
      mockEvent.headers = {
        'Authorization': 'Bearer some-token',
      };

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        '/aviary/shared/api-key'
      );

      expect(result.authorized).toBe(false);
      expect(result.method).toBe('none');
    });

    it('should ignore API Gateway requestContext (not supported)', async () => {
      mockEvent.headers = {};
      mockEvent.requestContext = {
        identity: {
          apiKeyId: 'some-api-gateway-key',
        },
      } as any;

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        '/aviary/shared/api-key'
      );

      expect(result.authorized).toBe(false);
      expect(result.method).toBe('none');
    });

    it('should only check X-API-Key header when multiple headers present', async () => {
      mockEvent.headers = {
        'X-API-Key': 'valid-shared-key-12345',
        'Authorization': 'Bearer some-token',
      };
      mockEvent.requestContext = {
        identity: {
          apiKeyId: 'some-api-gateway-key',
        },
      } as any;

      const result = await authorizeRequest(
        mockEvent as APIGatewayProxyEvent,
        '/aviary/shared/api-key'
      );

      expect(result.authorized).toBe(true);
      expect(result.method).toBe('shared-key');
    });
  });
});
