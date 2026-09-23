import { describe, expect, it } from 'vitest';
import { AdminConstants } from '@/lib/constants/admin.constants';

describe('AdminConstants', () => {
  describe('ENDPOINTS.PLUGINS.INSTALL', () => {
    it('fills the plugin install slug placeholder instead of appending to it', () => {
      expect(AdminConstants.ENDPOINTS.PLUGINS.INSTALL('tracker')).toBe('/api/v1/plugins/install/tracker');
    });

    it('encodes slugs safely for transport', () => {
      expect(AdminConstants.ENDPOINTS.PLUGINS.INSTALL('tracker pro')).toBe('/api/v1/plugins/install/tracker%20pro');
    });
  });
});
