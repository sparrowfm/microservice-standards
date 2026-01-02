import { describe, it, expect } from 'vitest';
import {
  normalizeApiPath,
  extractApiVersion,
  isValidApiVersion,
} from '../src/path-normalization';

describe('normalizeApiPath', () => {
  describe('with service prefix (API Gateway paths)', () => {
    it('strips service prefix from versioned paths', () => {
      expect(normalizeApiPath('/nightingale/v1/mix/jobs', 'nightingale')).toBe(
        '/v1/mix/jobs'
      );
      expect(normalizeApiPath('/condor/v1/tts/jobs', 'condor')).toBe(
        '/v1/tts/jobs'
      );
      expect(normalizeApiPath('/magpie/v1/sdc/generate', 'magpie')).toBe(
        '/v1/sdc/generate'
      );
    });

    it('strips service prefix from non-versioned paths', () => {
      expect(normalizeApiPath('/nightingale/health', 'nightingale')).toBe(
        '/health'
      );
      expect(normalizeApiPath('/condor/status', 'condor')).toBe('/status');
    });

    it('handles paths with path parameters', () => {
      expect(
        normalizeApiPath('/nightingale/v1/mix/jobs/job_123', 'nightingale')
      ).toBe('/v1/mix/jobs/job_123');
      expect(normalizeApiPath('/condor/v1/tts/jobs/tts_456', 'condor')).toBe(
        '/v1/tts/jobs/tts_456'
      );
    });

    it('handles nested paths', () => {
      expect(
        normalizeApiPath(
          '/nightingale/v1/mix/jobs/job_123/remix',
          'nightingale'
        )
      ).toBe('/v1/mix/jobs/job_123/remix');
    });

    it('handles path that is exactly the service prefix', () => {
      expect(normalizeApiPath('/nightingale', 'nightingale')).toBe('/');
    });
  });

  describe('without service prefix (direct service calls)', () => {
    it('passes through already-normalized versioned paths', () => {
      expect(normalizeApiPath('/v1/mix/jobs', 'nightingale')).toBe(
        '/v1/mix/jobs'
      );
      expect(normalizeApiPath('/v1/tts/jobs', 'condor')).toBe('/v1/tts/jobs');
    });

    it('passes through non-versioned paths', () => {
      expect(normalizeApiPath('/health', 'nightingale')).toBe('/health');
      expect(normalizeApiPath('/status', 'condor')).toBe('/status');
    });
  });

  describe('wrong service prefix', () => {
    it('does not strip mismatched service prefix', () => {
      expect(normalizeApiPath('/condor/v1/tts/jobs', 'nightingale')).toBe(
        '/condor/v1/tts/jobs'
      );
      expect(normalizeApiPath('/nightingale/v1/mix/jobs', 'condor')).toBe(
        '/nightingale/v1/mix/jobs'
      );
    });
  });

  describe('edge cases', () => {
    it('handles empty path', () => {
      expect(normalizeApiPath('', 'nightingale')).toBe('/');
    });

    it('handles path without leading slash', () => {
      expect(normalizeApiPath('nightingale/v1/mix/jobs', 'nightingale')).toBe(
        '/v1/mix/jobs'
      );
      expect(normalizeApiPath('v1/mix/jobs', 'nightingale')).toBe(
        '/v1/mix/jobs'
      );
    });

    it('handles empty service prefix', () => {
      expect(normalizeApiPath('/v1/mix/jobs', '')).toBe('/v1/mix/jobs');
      expect(normalizeApiPath('v1/mix/jobs', '')).toBe('/v1/mix/jobs');
    });

    it('handles service prefix as substring of path segment', () => {
      // 'night' is not the same as 'nightingale'
      expect(normalizeApiPath('/night/v1/jobs', 'nightingale')).toBe(
        '/night/v1/jobs'
      );
      // 'nightingale-extra' starts with 'nightingale' but is not equal
      expect(
        normalizeApiPath('/nightingale-extra/v1/jobs', 'nightingale')
      ).toBe('/nightingale-extra/v1/jobs');
    });

    it('handles double slashes gracefully', () => {
      // After stripping prefix, we might get paths starting with //
      expect(normalizeApiPath('/nightingale//v1/mix/jobs', 'nightingale')).toBe(
        '//v1/mix/jobs'
      );
    });

    it('is idempotent - calling twice gives same result', () => {
      const path = '/nightingale/v1/mix/jobs';
      const once = normalizeApiPath(path, 'nightingale');
      const twice = normalizeApiPath(once, 'nightingale');
      expect(once).toBe('/v1/mix/jobs');
      expect(twice).toBe('/v1/mix/jobs');
    });
  });

  describe('all Aviary services', () => {
    const services = [
      'nightingale',
      'condor',
      'magpie',
      'skylark',
      'osprey',
      'egret',
      'cuckoo',
      'mockingbird',
      'peacock',
      'starling',
    ];

    it.each(services)('handles %s service prefix correctly', (service) => {
      expect(normalizeApiPath(`/${service}/v1/test`, service)).toBe('/v1/test');
      expect(normalizeApiPath(`/${service}/health`, service)).toBe('/health');
    });
  });
});

describe('extractApiVersion', () => {
  it('extracts v1 version', () => {
    expect(extractApiVersion('/v1/mix/jobs')).toBe('v1');
    expect(extractApiVersion('/v1/tts/jobs/tts_123')).toBe('v1');
  });

  it('extracts v2 version', () => {
    expect(extractApiVersion('/v2/mix/jobs')).toBe('v2');
  });

  it('extracts higher versions', () => {
    expect(extractApiVersion('/v10/test')).toBe('v10');
    expect(extractApiVersion('/v99/test')).toBe('v99');
  });

  it('returns null for non-versioned paths', () => {
    expect(extractApiVersion('/health')).toBeNull();
    expect(extractApiVersion('/status')).toBeNull();
    expect(extractApiVersion('/')).toBeNull();
  });

  it('returns null for version not at start', () => {
    expect(extractApiVersion('/api/v1/test')).toBeNull();
    expect(extractApiVersion('/service/v1/test')).toBeNull();
  });

  it('returns null for malformed versions', () => {
    expect(extractApiVersion('/v/test')).toBeNull();
    expect(extractApiVersion('/vX/test')).toBeNull();
    expect(extractApiVersion('/v1test')).toBeNull();
  });
});

describe('isValidApiVersion', () => {
  describe('with expected version v1 (default)', () => {
    it('returns true for v1 paths', () => {
      expect(isValidApiVersion('/v1/mix/jobs')).toBe(true);
      expect(isValidApiVersion('/v1/tts/jobs', 'v1')).toBe(true);
    });

    it('returns false for v2 paths', () => {
      expect(isValidApiVersion('/v2/mix/jobs')).toBe(false);
      expect(isValidApiVersion('/v2/tts/jobs', 'v1')).toBe(false);
    });

    it('returns true for non-versioned paths (health checks allowed)', () => {
      expect(isValidApiVersion('/health')).toBe(true);
      expect(isValidApiVersion('/status')).toBe(true);
      expect(isValidApiVersion('/')).toBe(true);
    });
  });

  describe('with expected version v2', () => {
    it('returns true for v2 paths', () => {
      expect(isValidApiVersion('/v2/mix/jobs', 'v2')).toBe(true);
    });

    it('returns false for v1 paths', () => {
      expect(isValidApiVersion('/v1/mix/jobs', 'v2')).toBe(false);
    });

    it('returns true for non-versioned paths', () => {
      expect(isValidApiVersion('/health', 'v2')).toBe(true);
    });
  });
});
