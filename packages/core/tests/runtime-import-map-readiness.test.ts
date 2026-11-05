// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { RuntimeImportMapReadiness } from '@core/runtime-import-map-readiness';

describe('RuntimeImportMapReadiness — bundles wait for the import map', () => {
  afterEach(() => document.getElementById(RuntimeImportMapReadiness.SCRIPT_ID)?.remove());

  it('waits until the map is published, then resolves', async () => {
    let settled = false;
    const wait = RuntimeImportMapReadiness.whenPublished().then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    const script = document.createElement('script');
    script.id = RuntimeImportMapReadiness.SCRIPT_ID;
    script.type = 'importmap';
    script.textContent = JSON.stringify({ imports: { react: 'data:text/javascript,' } });
    document.head.appendChild(script);
    window.dispatchEvent(new CustomEvent(RuntimeImportMapReadiness.READY_EVENT));
    await wait;
    expect(settled).toBe(true);
  });

  it('resolves at once when the map is already there', async () => {
    const script = document.createElement('script');
    script.id = RuntimeImportMapReadiness.SCRIPT_ID;
    script.type = 'importmap';
    script.textContent = '{"imports":{}}';
    document.head.appendChild(script);
    expect(RuntimeImportMapReadiness.isPublished()).toBe(true);
    await expect(RuntimeImportMapReadiness.whenPublished()).resolves.toBeUndefined();
  });
});
