import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationUrlUtils } from '@core/application-url-utils';

/**
 * Three properties, each load-bearing.
 *
 * 1. The internal address wins, so one stack talks to itself by Compose service name.
 * 2. An EMPTY value is not a value — a split deployment clears the variable and the app's own
 *    `ADMIN_URL`/`FRONTEND_URL` takes over. Treat `''` as configured and that deployment POSTs at
 *    nothing.
 * 3. It reads the ENVIRONMENT ONLY. This one is a security boundary: the resolved address is where the
 *    internal secret gets sent, and the DB-backed reader answers for the frontend out of `site_url`
 *    even on a deployment that runs no frontend.
 */
describe('ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment', () => {
  const keys = ['ADMIN_URL', 'INTERNAL_ADMIN_URL', 'FRONTEND_URL', 'INTERNAL_FRONTEND_URL'];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it('prefers the deployment-internal address over the public one', () => {
    process.env.ADMIN_URL = 'https://admin.example.com';
    process.env.INTERNAL_ADMIN_URL = 'http://admin:3000';
    expect(ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment('admin')).toBe('http://admin:3000');
  });

  it('falls back to the app\'s own public URL env var when the internal one is empty or unset', () => {
    process.env.FRONTEND_URL = 'https://shop.example.com';

    process.env.INTERNAL_FRONTEND_URL = '';
    expect(ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment('frontend')).toBe('https://shop.example.com');

    delete process.env.INTERNAL_FRONTEND_URL;
    expect(ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment('frontend')).toBe('https://shop.example.com');
  });

  /**
   * The api+admin deployment. `site_url` is set on essentially every install and backfills the
   * frontend through the DB-backed reader, so before this boundary existed the admin showed a live
   * "Restart frontend" button on a deployment with no frontend — and pressing it POSTed the internal
   * secret to whatever host that CMS setting named.
   */
  it('ignores the DB-backed app URL settings, which decide links but not where a secret is sent', () => {
    delete process.env.FRONTEND_URL;
    delete process.env.INTERNAL_FRONTEND_URL;
    ApplicationUrlUtils.registerAppUrlSettingsReader((app) => (
      app === ApplicationUrlUtils.FRONTEND_APP ? 'https://from-the-cms.example.com' : null
    ));
    try {
      // The public read still honours the setting — links and emails depend on it.
      expect(ApplicationUrlUtils.readAppBaseUrlFromEnvironment('frontend')).toBe('https://from-the-cms.example.com');
      // The credential-bearing read does not.
      expect(ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment('frontend')).toBe('');
    } finally {
      ApplicationUrlUtils.registerAppUrlSettingsReader(null);
    }
  });

  it('does not accept the generic frontend URL aliases that may name a marketing site', () => {
    delete process.env.FRONTEND_URL;
    delete process.env.INTERNAL_FRONTEND_URL;
    process.env.APP_URL = 'https://marketing.example.com';
    try {
      expect(ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment('frontend')).toBe('');
    } finally {
      delete process.env.APP_URL;
    }
  });

  it('returns the empty contract when neither is configured — never an invented host', () => {
    delete process.env.ADMIN_URL;
    delete process.env.INTERNAL_ADMIN_URL;
    expect(ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment('admin')).toBe('');
  });

  it('trims a trailing slash, like every other app-URL read', () => {
    process.env.INTERNAL_ADMIN_URL = 'http://admin:3000/';
    expect(ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment('admin')).toBe('http://admin:3000');
  });

  it('has no internal address for an app it does not know', () => {
    expect(ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment('database')).toBe('');
  });
});
