import { describe, expect, it } from '@jest/globals';
import { CollectionFieldGuard } from '../src/controllers/collection-field-guard';

describe('CollectionFieldGuard', () => {
  it('treats read-only fields as overrideable by default', () => {
    const guard = new CollectionFieldGuard({} as any);

    expect(
      guard.isReadOnlyOverrideable({
        admin: {
          readOnly: true,
        },
      })
    ).toBe(true);
  });

  it('respects explicit read-only override opt-out flags', () => {
    const guard = new CollectionFieldGuard({} as any);

    expect(
      guard.isReadOnlyOverrideable({
        admin: {
          readOnly: true,
          readOnlyOverride: false,
        },
      })
    ).toBe(false);

    expect(
      guard.isReadOnlyOverrideable({
        admin: {
          readOnly: true,
          readOnlyOverride: 'never',
        },
      })
    ).toBe(false);

    expect(
      guard.isReadOnlyOverrideable({
        admin: {
          readOnly: true,
          allowReadOnlyOverride: false,
        },
      })
    ).toBe(false);
  });
});
