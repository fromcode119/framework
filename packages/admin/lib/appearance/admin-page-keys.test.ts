import { describe, expect, it } from 'vitest';
import { AdminPageKeys } from './admin-page-keys';

describe('AdminPageKeys', () => {
  it('exposes stable string keys for overridable admin pages', () => {
    expect(AdminPageKeys.DASHBOARD).toBe('dashboard');
    expect(AdminPageKeys.COLLECTION_LIST).toBe('collection-list');
    expect(AdminPageKeys.COLLECTION_EDIT).toBe('collection-edit');
    expect(AdminPageKeys.SETTINGS).toBe('settings');
  });
});
