import { describe, expect, it, vi } from 'vitest';

const stored = new Map<string, string>();
vi.mock('@api/services/system/platform-meta-store', () => ({
  PlatformMetaStore: class {
    async read(key: string) { return stored.get(key) ?? null; }
    async write(key: string, value: string) { stored.set(key, value); }
  },
}));

import { UpdaterStatusStore } from '@api/services/system/updater-status-store';

describe('UpdaterStatusStore', () => {
  it('keeps how the update replaced the apps and why, and the steps it took', async () => {
    const store = new UpdaterStatusStore({});
    const steps = Array.from({ length: 50 }, (_, index) => `step ${index}`);
    steps.push('Deploy mode: restart — not enough memory');

    await store.report({ state: 'succeeded', from: '0.2.579', to: '0.2.580', deployMode: 'restart', deployReason: 'not enough memory', steps });

    const status: any = await store.status();
    expect(status.deployMode).toBe('restart');
    expect(status.deployReason).toBe('not enough memory');
    expect(status.steps).toHaveLength(40);
    expect(status.steps.at(-1)).toBe('Deploy mode: restart — not enough memory');
  });

  it('stores no steps when the report carries none', async () => {
    await new UpdaterStatusStore({}).report({ state: 'idle', step: 'x' });
    expect(((await new UpdaterStatusStore({}).status()) as any).steps).toEqual([]);
  });
});
