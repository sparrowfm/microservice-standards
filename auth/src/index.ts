/**
 * Aviary Shared Authentication Library
 *
 * Provides platform-wide shared API key authentication for all Aviary v2 services.
 * Validates X-API-Key headers against secrets stored in AWS Secrets Manager.
 *
 * Also provides API utilities for consistent path normalization across services.
 *
 * @packageDocumentation
 */

export { authorizeRequest, getSecretValue, type AuthResult } from './authorize';
export {
  normalizeApiPath,
  extractApiVersion,
  isValidApiVersion,
} from './path-normalization';
