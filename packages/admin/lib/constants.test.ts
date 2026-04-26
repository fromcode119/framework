import { describe, expect, it } from 'vitest';
import { AdminConstants } from './constants';

describe('AdminConstants', () => {
  describe('ENDPOINTS.PLUGINS.INSTALL', () => {
    it('fills the marketplace install slug placeholder instead of appending to it', () => {
      expect(AdminConstants.ENDPOINTS.PLUGINS.INSTALL('analytics')).toBe('/api/v1/marketplace/install/analytics');
    });

    it('encodes slugs safely for transport', () => {
      expect(AdminConstants.ENDPOINTS.PLUGINS.INSTALL('analytics pro')).toBe('/api/v1/marketplace/install/analytics%20pro');
    });
  });
});
