import { APIGatewayProxyEvent } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

/**
 * Result of authorization attempt
 */
export interface AuthResult {
  /** Whether the request is authorized */
  authorized: boolean;
  /** Authentication method used */
  method: 'shared-key' | 'none';
}

const secretsClient = new SecretsManagerClient({});

/**
 * Retrieve secret value from AWS Secrets Manager
 */
export async function getSecretValue(secretPath: string, key: string): Promise<string | null> {
  try {
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretPath })
    );

    if (!response.SecretString) return null;

    const secrets = JSON.parse(response.SecretString);
    return secrets[key] || null;
  } catch (error) {
    console.error(`Failed to retrieve secret ${secretPath}:`, error);
    return null;
  }
}

/**
 * Authorizes an API Gateway request using shared API key authentication.
 *
 * Validates the X-API-Key header (case-insensitive) against the expected key
 * stored in AWS Secrets Manager.
 *
 * @param event - API Gateway proxy event
 * @param secretPath - AWS Secrets Manager path for the shared API key
 * @param options - Optional configuration for key name
 * @returns Authorization result indicating success or failure
 *
 * @example
 * ```typescript
 * const result = await authorizeRequest(event, '/aviary/shared/api-key');
 * if (!result.authorized) {
 *   return { statusCode: 401, body: 'Unauthorized' };
 * }
 * ```
 */
export async function authorizeRequest(
  event: APIGatewayProxyEvent,
  secretPath: string,
  options?: {
    sharedKeyName?: string;
  }
): Promise<AuthResult> {
  const { sharedKeyName = 'AVIARY_SHARED_API_KEY' } = options || {};

  // Check for X-API-Key header (case-insensitive)
  const sharedKey = event.headers?.['X-API-Key'] || event.headers?.['x-api-key'];

  if (!sharedKey) {
    return { authorized: false, method: 'none' };
  }

  const trimmedKey = sharedKey.trim();
  if (!trimmedKey) {
    return { authorized: false, method: 'none' };
  }

  try {
    const expectedKey = await getSecretValue(secretPath, sharedKeyName);
    if (expectedKey && trimmedKey === expectedKey) {
      return { authorized: true, method: 'shared-key' };
    }
  } catch (error) {
    console.error('Authorization failed:', error);
    return { authorized: false, method: 'none' };
  }

  return { authorized: false, method: 'none' };
}
