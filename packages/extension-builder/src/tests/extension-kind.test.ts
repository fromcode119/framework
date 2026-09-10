import { describe, expect, it } from 'vitest';
import { ExtensionKind } from '@extension-builder/extension-kind';

describe('ExtensionKind', () => {
  it('maps each kind to the directory that holds it', () => {
    expect(ExtensionKind.PLUGIN.directoryName()).toBe('plugins');
    expect(ExtensionKind.THEME.directoryName()).toBe('themes');
    expect(ExtensionKind.APPEARANCE.directoryName()).toBe('appearance');
  });

  it('inherits lookup from Enum, which reports absence rather than throwing', () => {
    expect(ExtensionKind.fromValue('theme')).toBe(ExtensionKind.THEME);
    expect(ExtensionKind.fromValue('widget')).toBeUndefined();
  });

  it('require() refuses an unknown value rather than guessing', () => {
    expect(() => ExtensionKind.require('widget')).toThrow(/widget/);
  });

  it('registers all three members with the base registry', () => {
    expect(ExtensionKind.values().map((k) => k.value)).toEqual(['plugin', 'theme', 'appearance']);
  });
});
