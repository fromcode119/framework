import { describe, it, expect, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { ClientRuntimeConstants } from '@fromcode119/core/client';
import { ColorSchemeBootScript } from '../lib/color-scheme-boot-script';

const STORAGE_KEY = ClientRuntimeConstants.FRONTEND.STORAGE_KEYS.COLOR_SCHEME;
const ATTRIBUTE = ClientRuntimeConstants.FRONTEND.ATTRIBUTES.COLOR_SCHEME;

/**
 * Executes the EMITTED script text in a sandbox, the way the browser's inline `<script>`
 * would. This is what proves the TypeScript→`toString()`→inline-script mechanism actually
 * produces runnable code, rather than only asserting on the source function.
 */
const runEmitted = (storage: { getItem: () => string | null }) => {
  const setAttribute = vi.fn();
  runInNewContext(ColorSchemeBootScript.inlineScript(), {
    window: { localStorage: storage },
    document: { documentElement: { setAttribute } },
  });
  return setAttribute;
};

const withStored = (stored: string | null) => runEmitted({ getItem: () => stored });

describe('ColorSchemeBootScript', () => {
  it('emits a self-executing script carrying the contract constants (no hardcoded keys)', () => {
    const script = ColorSchemeBootScript.inlineScript();
    expect(script.startsWith('(function ')).toBe(true);
    expect(script).toContain(JSON.stringify(STORAGE_KEY));
    expect(script).toContain(JSON.stringify(ATTRIBUTE));
    // Serialized from real TypeScript — the script carries the method's own source.
    expect(script).toContain('documentElement');
  });

  it('applies a stored dark scheme pre-paint', () => {
    const getItem = vi.fn(() => 'dark');
    const setAttribute = runEmitted({ getItem });
    expect(getItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(setAttribute).toHaveBeenCalledWith(ATTRIBUTE, 'dark');
  });

  it('applies a stored light scheme', () => {
    expect(withStored('light')).toHaveBeenCalledWith(ATTRIBUTE, 'light');
  });

  it('sets no attribute without a stored value or for a junk value', () => {
    expect(withStored(null)).not.toHaveBeenCalled();
    expect(withStored('sepia')).not.toHaveBeenCalled();
  });

  it('never throws when storage is blocked', () => {
    let setAttribute: ReturnType<typeof vi.fn> | undefined;
    expect(() => {
      setAttribute = runEmitted({ getItem: () => { throw new Error('blocked'); } });
    }).not.toThrow();
    expect(setAttribute).not.toHaveBeenCalled();
  });
});
