/**
 * API Gateway Path Normalization Utilities
 *
 * Standardizes how all Aviary services handle unified API Gateway path prefixes.
 * The unified API Gateway at api.chirpy.studio/{service}/* adds a service prefix
 * that must be stripped before routing.
 *
 * @packageDocumentation
 */

/**
 * Normalizes API Gateway paths by removing service prefixes.
 *
 * Handles paths from unified API Gateway (api.chirpy.studio/{service}/v1/*)
 * and direct service invocations (/v1/*).
 *
 * @param rawPath - The incoming event.path from API Gateway
 * @param servicePrefix - The service name (e.g., 'nightingale', 'condor', 'magpie')
 * @returns Normalized path starting with / (service prefix stripped if present)
 *
 * @example
 * // API Gateway prefixed path
 * normalizeApiPath('/nightingale/v1/mix/jobs', 'nightingale')
 * // => '/v1/mix/jobs'
 *
 * @example
 * // Already normalized path (direct service call)
 * normalizeApiPath('/v1/mix/jobs', 'nightingale')
 * // => '/v1/mix/jobs'
 *
 * @example
 * // Non-versioned path
 * normalizeApiPath('/nightingale/health', 'nightingale')
 * // => '/health'
 *
 * @example
 * // Wrong service prefix (no stripping)
 * normalizeApiPath('/condor/v1/tts/jobs', 'nightingale')
 * // => '/condor/v1/tts/jobs'
 */
export function normalizeApiPath(rawPath: string, servicePrefix: string): string {
  // Handle empty/null path
  if (!rawPath) {
    return '/';
  }

  // If no service prefix provided, return path as-is (with leading slash)
  if (!servicePrefix) {
    return rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  }

  // Ensure leading slash
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

  // Build prefix pattern (e.g., '/nightingale')
  const prefixPattern = `/${servicePrefix}`;

  // If path starts with service prefix followed by '/' or end of string, strip it
  // This prevents '/nightingale-extra' from being matched when prefix is 'nightingale'
  if (
    path === prefixPattern ||
    path.startsWith(`${prefixPattern}/`)
  ) {
    const withoutPrefix = path.substring(prefixPattern.length);

    // Handle edge case: path was exactly '/{service}' with no trailing content
    if (!withoutPrefix) {
      return '/';
    }

    // withoutPrefix already starts with '/' due to our check above
    return withoutPrefix;
  }

  // Path doesn't have this service's prefix - return as-is
  return path;
}

/**
 * Extract the API version from a normalized path.
 *
 * @param normalizedPath - Path starting with /v1/, /v2/, etc.
 * @returns Version string (e.g., 'v1', 'v2') or null if no version prefix
 *
 * @example
 * extractApiVersion('/v1/mix/jobs') // => 'v1'
 * extractApiVersion('/v2/tts/jobs') // => 'v2'
 * extractApiVersion('/health')      // => null
 */
export function extractApiVersion(normalizedPath: string): string | null {
  const versionMatch = normalizedPath.match(/^\/v(\d+)\//);
  return versionMatch ? `v${versionMatch[1]}` : null;
}

/**
 * Validates that a path uses the expected API version.
 *
 * Returns true for non-versioned paths (like /health) to allow health checks
 * and other infrastructure endpoints.
 *
 * @param normalizedPath - Path to validate
 * @param expectedVersion - Expected version (default: 'v1')
 * @returns true if version matches or path is non-versioned
 *
 * @example
 * isValidApiVersion('/v1/mix/jobs', 'v1') // => true
 * isValidApiVersion('/v2/mix/jobs', 'v1') // => false
 * isValidApiVersion('/health', 'v1')      // => true (non-versioned allowed)
 */
export function isValidApiVersion(
  normalizedPath: string,
  expectedVersion: string = 'v1'
): boolean {
  const version = extractApiVersion(normalizedPath);
  // Allow non-versioned paths (health checks, etc.) or matching version
  return version === null || version === expectedVersion;
}
