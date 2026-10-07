import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaContextProxy } from '@core/plugin/context/media';
import { MediaIngestBridge } from '@core/plugin/media-ingest-bridge';

const manager = { db: {} } as any;
const securityWith = (capabilities: string[]) => ({
  hasCapability: (name: string) => capabilities.includes(name),
  handleViolation: vi.fn((name: string) => { throw new Error(`Security Violation: missing ${name}`); }),
  handleRateLimit: vi.fn(),
}) as any;

describe('context.media.ingest', () => {
  afterEach(() => {
    // The bridge is process-global; leave no ingester behind for other suites.
    MediaIngestBridge.install(undefined as any);
  });

  it('refuses a plugin without the content capability, before reaching the bridge', async () => {
    const ingester = vi.fn();
    MediaIngestBridge.install(ingester);
    const media = MediaContextProxy.createMediaProxy(manager, securityWith(['database']));
    await expect(media.ingest({ filename: 'a.jpg', sourceUrl: 'https://example.com/a.jpg' })).rejects.toThrow(/content/);
    expect(ingester).not.toHaveBeenCalled();
  });

  it('fails CLOSED before the api installs the bridge', async () => {
    const media = MediaContextProxy.createMediaProxy(manager, securityWith(['content']));
    await expect(media.ingest({ filename: 'a.jpg', base64: 'AA==' })).rejects.toThrow(/bridge/);
  });

  it('forwards the input to the installed ingester and returns its record', async () => {
    const ingester = vi.fn(async () => ({ id: 7, url: '/uploads/a.jpg' }));
    MediaIngestBridge.install(ingester);
    const media = MediaContextProxy.createMediaProxy(manager, securityWith(['content']));
    const input = { filename: 'a.jpg', sourceUrl: 'https://example.com/a.jpg', alt: 'A' };

    await expect(media.ingest(input)).resolves.toEqual({ id: 7, url: '/uploads/a.jpg' });
    expect(ingester).toHaveBeenCalledWith(input);
  });
});
