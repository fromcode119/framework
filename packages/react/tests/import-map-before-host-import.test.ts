// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeImportMapReadiness, RuntimeRegistryAccess } from '@fromcode119/core/client';
import { ImportMapInstaller } from '@react/helpers/import-map-installer';

/**
 * Firefox ignores an import map inserted after any module load has started ("Import maps are not
 * allowed after a module load or preload has started"). The bridge's host import IS a module load, so
 * a map appended after it left every theme and plugin bundle unresolvable in Firefox: the storefront
 * never hydrated — endless product spinners, pagination stuck on page 1. Chromium accepts a late map,
 * which is why only Firefox broke. The map must be in the document before the host import starts.
 */
describe('ImportMapInstaller — the map precedes every module load', () => {
  afterEach(() => {
    document.getElementById(RuntimeImportMapReadiness.SCRIPT_ID)?.remove();
    vi.restoreAllMocks();
  });

  const args = {
    apiUrl: '',
    stabilityRef: { current: {} },
    runtimeModules: {},
    RuntimeConstants: { MODULE_NAMES: { ADMIN: '@fromcode119/admin', ADMIN_COMPONENTS: '@fromcode119/admin/components' }, ADMIN_RUNTIME_EXPORT_KEYS: [] },
  } as any;
  const sources = { reactExportSource: '', adminExportSource: '', sdkExportSource: '', sdkReactExportSource: '' } as any;

  it('writes the map before the host import, and marks it ready only after the host is connected', async () => {
    let mapWhenHostImportStarted: string | null | undefined;
    let connectHost!: () => void;
    vi.spyOn(RuntimeRegistryAccess, 'connect').mockImplementation(() => {
      mapWhenHostImportStarted = document.getElementById(RuntimeImportMapReadiness.SCRIPT_ID)?.textContent;
      return new Promise<void>((resolve) => { connectHost = resolve; });
    });

    ImportMapInstaller.install(args, sources);

    expect(mapWhenHostImportStarted).toContain('"react"');
    expect(document.head.querySelector(`script[type="importmap"]#${RuntimeImportMapReadiness.SCRIPT_ID}`)).not.toBeNull();
    expect(RuntimeImportMapReadiness.isPublished()).toBe(false);

    const ready = RuntimeImportMapReadiness.whenPublished();
    connectHost();
    await ready;
    expect(RuntimeImportMapReadiness.isPublished()).toBe(true);
  });

  it('still marks the map ready when the host cannot load, so bundles fail loudly instead of waiting', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(RuntimeRegistryAccess, 'connect').mockRejectedValue(new Error('host unavailable'));

    ImportMapInstaller.install(args, sources);
    await RuntimeImportMapReadiness.whenPublished();

    expect(RuntimeImportMapReadiness.isPublished()).toBe(true);
  });
});
