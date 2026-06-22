import { describe, expect, it } from 'vitest';
import { AdminComponentKeys } from './admin-component-keys';

describe('AdminComponentKeys', () => {
  it('exposes stable string keys for overridable primitives', () => {
    expect(AdminComponentKeys.BUTTON).toBe('Button');
    expect(AdminComponentKeys.INPUT).toBe('Input');
  });
});
