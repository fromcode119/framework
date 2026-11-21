import { describe, it, expect } from 'vitest';
import { StackImagePackages } from '@cli/services/stack/stack-image-packages';

describe('StackImagePackages', () => {
  it('names a package without its range, scoped or not', () => {
    expect(StackImagePackages.nameOf('@zxing/browser@^0.2.1')).toBe('@zxing/browser');
    expect(StackImagePackages.nameOf('zod@3.1.0')).toBe('zod');
    expect(StackImagePackages.nameOf('zod')).toBe('zod');
  });

  it('lists only what the container does not have', () => {
    const declared = ['@zxing/browser@^0.2.1', 'zod@^3', 'react@^19'];
    expect(StackImagePackages.missing(declared, new Set(['zod', 'react']))).toEqual(['@zxing/browser@^0.2.1']);
    expect(StackImagePackages.missing(declared, new Set(['zod', 'react', '@zxing/browser']))).toEqual([]);
  });
});
