import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationUrlUtils } from '@core/utils/application-url-utils';

/**
 * A container created before 0.2.532 knows its api only as `API_URL`, and the updater keeps that
 * environment. Without it the storefront fell back to `http://localhost:3000` — itself — and every
 * request it served fetched itself again until the process stopped answering.
 */
describe('server api candidates on an updated install', () => {
  const keys = ['API_URL', 'INTERNAL_API_URL', ApplicationUrlUtils.OWN_PORTS_ENV];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it('uses a legacy API_URL that names the api container', () => {
    delete process.env.INTERNAL_API_URL;
    process.env.API_URL = 'http://atlantis-api:3000';
    expect(ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment('api')).toBe('http://atlantis-api:3000');
    expect(ApplicationUrlUtils.getServerApiBaseUrlCandidates()[0]).toBe('http://atlantis-api:3000');
  });

  it('never takes a public domain from API_URL', () => {
    delete process.env.INTERNAL_API_URL;
    process.env.API_URL = 'https://shop.example.com/api';
    expect(ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment('api')).toBe('');
  });

  it('INTERNAL_API_URL still wins over the legacy name', () => {
    process.env.INTERNAL_API_URL = 'http://api:3000';
    process.env.API_URL = 'http://old-api:3000';
    expect(ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment('api')).toBe('http://api:3000');
  });

  it('never offers this process its own loopback port as the api', () => {
    delete process.env.INTERNAL_API_URL;
    delete process.env.API_URL;
    ApplicationUrlUtils.recordOwnPorts([3000, 3100]);
    const candidates = ApplicationUrlUtils.getServerApiBaseUrlCandidates();
    expect(candidates).not.toContain('http://localhost:3000');
    expect(candidates).toContain('http://api:3000');
  });
});
