import { describe, expect, it } from 'vitest';
import { StackCapacity } from '@cli/services/stack/stack-capacity';

const GIB = 1024 ** 3;

describe('StackCapacity', () => {
  it('reads a memory limit written as 4G, 512m or bytes', () => {
    expect(StackCapacity.bytesOf('4G')).toBe(4 * GIB);
    expect(StackCapacity.bytesOf('512m')).toBe(512 * 1024 ** 2);
    expect(StackCapacity.bytesOf('1048576')).toBe(1048576);
    expect(StackCapacity.bytesOf(null)).toBe(0);
  });

  it('is silent while the new stack fits next to the live ones', () => {
    expect(StackCapacity.warning(16 * GIB, ['pw'], 8 * GIB)).toBe('');
  });

  it('names the live stacks and the arithmetic once it does not fit', () => {
    const warning = StackCapacity.warning(16 * GIB, ['pw', 'su'], 8 * GIB);
    expect(warning).toContain('Docker has 16 GiB; 3 stacks can take up to 24 GiB');
    expect(warning).toContain('pw, su');
  });

  it('gives no advice when it cannot tell how much Docker has', () => {
    expect(StackCapacity.warning(0, ['pw'], 8 * GIB)).toBe('');
  });
});
