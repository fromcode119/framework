import { describe, expect, it } from 'vitest';
import { AdminAppearanceConstants } from './admin-appearance-constants';

describe('AdminAppearanceConstants', () => {
  it('names the built-in default appearance id "default"', () => {
    expect(AdminAppearanceConstants.DEFAULT_APPEARANCE_ID).toBe('default');
  });
});
