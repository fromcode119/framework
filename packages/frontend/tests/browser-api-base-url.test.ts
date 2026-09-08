/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { FrontendApiBaseUrl } from '../lib/api-base-url';

/**
 * The site's host is the only thing that names the site, so the storefront's browser must call the API
 * there. No configuration decides this: a value that pointed elsewhere is exactly how a shop with Econt
 * credentials ended up reading the platform's empty ones.
 */
describe('FrontendApiBaseUrl', () => {
  const original = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'https://tenant-a.example', href: 'https://tenant-a.example/shop' },
    });
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  it("uses the page's own origin in the browser", () => {
    expect(FrontendApiBaseUrl.resolveFrontendApiBaseUrl()).toBe('https://tenant-a.example');
  });

  it('ignores a configured API host rather than sending the call to a site-less one', () => {
    expect(FrontendApiBaseUrl.resolveFrontendApiBaseUrl('https://api.example.com')).toBe('https://tenant-a.example');
  });
});
