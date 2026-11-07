import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiPathUtils, ApiVersionUtils, RealtimeRoomClient, TenantRecord, TenantRouteMap } from '@fromcode119/core';
import { GatewayApiHostPath } from '@cli/services/gateway/gateway-api-host-path';

/**
 * The two ways a deployment reaches its api, end to end through the gateway:
 *
 * - the base path (`example.com/api/...`) on any app host;
 * - the ROOT of a host declared to be the api (`api.example.com/...`).
 *
 * The api always mounts under `/api` — the same in every process, none of which reads a domain from
 * the environment. A host the operator declared as the api (Sites → host role, or the api URL in
 * Settings) is served at its root by the gateway putting the base path back. So REST, GraphQL, the realtime socket and the auth routes all answer at both addresses.
 */
const site = TenantRecord.from({
  id: 'acme', slug: 'acme', primary_host: 'example.com', host_aliases: '["data.example.com"]',
  host_roles: '{"data.example.com":"api"}', state: 'active', kind: 'site',
});

const ENV_KEYS = ['API_URL', 'NEXT_PUBLIC_API_URL'] as const;

describe('api base path modes', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => { for (const key of ENV_KEYS) saved[key] = process.env[key]; });
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  const useApiUrl = (value: string) => {
    process.env.API_URL = value;
    delete process.env.NEXT_PUBLIC_API_URL;
  };

  const mapFor = (apiUrl: string) => TenantRouteMap.build([site], { api: apiUrl, frontend: 'example.com' });

  /** Every surface a client calls, as the api mounts it. */
  const surfaces = () => [
    ApiPathUtils.versioned('/collections/pages'),
    ApiPathUtils.versioned('/graphql'),
    RealtimeRoomClient.socketPath(),
    ApiPathUtils.authPath('/status'),
  ];

  it('default: an API_URL with no path mounts the api at /api', () => {
    useApiUrl('https://api.example.com');
    expect(ApiVersionUtils.API_BASE_PATH).toBe('/api');
    expect(surfaces().every((path) => path.startsWith('/api/'))).toBe(true);
  });

  it('the api mount never follows a path in an environment variable', () => {
    useApiUrl('https://example.com/data');
    expect(ApiVersionUtils.API_BASE_PATH).toBe('/api');
    expect(surfaces().every((path) => path.startsWith('/api/'))).toBe(true);
  });

  it('root: a host DECLARED as the api answers every surface at its root, under the default base path', () => {
    useApiUrl('https://api.example.com');
    const map = mapFor('https://api.example.com');
    for (const host of ['api.example.com', 'data.example.com']) {
      expect(GatewayApiHostPath.upstream(map, host, '/collections/pages')).toBe('/api/collections/pages');
      expect(GatewayApiHostPath.upstream(map, host, '/graphql?query=%7B__typename%7D')).toBe('/api/graphql?query=%7B__typename%7D');
      expect(GatewayApiHostPath.upstream(map, host, '/socket')).toBe(RealtimeRoomClient.socketPath());
      expect(GatewayApiHostPath.upstream(map, host, '/auth/status')).toBe(ApiPathUtils.authPath('/status'));
      // The /api address keeps working on the same host.
      for (const path of surfaces()) expect(GatewayApiHostPath.upstream(map, host, path)).toBe(path);
    }
  });

  it('root is decided by the host role the operator set, never by the hostname', () => {
    useApiUrl('https://example.com/data');
    const undeclared = TenantRecord.from({
      id: 'beta', slug: 'beta', primary_host: 'beta.test', host_aliases: '["api.beta.test"]',
      host_roles: '{"api.beta.test":"frontend"}', state: 'active', kind: 'site',
    });
    const map = TenantRouteMap.build([undeclared], {});
    expect(GatewayApiHostPath.upstream(map, 'api.beta.test', '/collections/pages')).toBe('/collections/pages');
  });
});
