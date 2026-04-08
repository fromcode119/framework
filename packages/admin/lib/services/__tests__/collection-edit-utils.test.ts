import { describe, expect, it } from 'vitest';
import { CollectionEditUtils } from '../../../components/collection/collection-edit-utils';

describe('CollectionEditUtils', () => {
  describe('normalizeCollectionFormData', () => {
    it('normalizes stored boolean strings for checkbox fields', () => {
      const payload = CollectionEditUtils.normalizeCollectionFormData(
        {
          disablePermalink: '0.0',
          featured: '1.0',
          title: 'Love Box',
        },
        [
          { name: 'disablePermalink', type: 'checkbox' },
          { name: 'featured', type: 'boolean' },
          { name: 'title', type: 'text' },
        ],
      );

      expect(payload.disablePermalink).toBe(false);
      expect(payload.featured).toBe(true);
      expect(payload.title).toBe('Love Box');
    });
  });
});