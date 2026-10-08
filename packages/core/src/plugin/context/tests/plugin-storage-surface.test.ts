import { describe, expect, it, vi } from 'vitest';
import { SystemConstants } from '@core/constants/system.constants';
import { IntegrationsContextProxy } from '@core/plugin/context/integrations';

/**
 * `context.storage` is the `IMediaManager` contract — `upload` and `remove` — and nothing else. It was
 * a Proxy over the whole media manager, so `driver` and `register` handed out the raw storage driver,
 * and its path sandbox named methods the manager does not have.
 */
function setup(mediaRows: Array<{ path: string }> = []) {
  const storage = {
    upload: vi.fn(async () => ({ url: '/uploads/doc-1.pdf', path: 'doc-1.pdf' })),
    remove: vi.fn(async () => undefined),
    stream: vi.fn(),
    createWebPVariant: vi.fn(),
    register: vi.fn(),
    driver: { delete: vi.fn() },
  };
  const db = {
    findOne: vi.fn(async (table: string, where: any) => (table === SystemConstants.TABLE.MEDIA ? mediaRows.find((r) => r.path === where.path) ?? null : null)),
    withPlatformAdmin: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  };
  const manager = { integrations: { storage }, db } as any;
  const proxy = IntegrationsContextProxy.createStorageProxy({ manifest: { slug: 'shop' } } as any, manager, {} as any) as any;
  return { storage, proxy, db };
}

describe('context.storage', () => {
  it.each([['driver'], ['register'], ['stream'], ['createWebPVariant'], ['publicUrl']])('does not hand out %s', (member) => {
    const { proxy } = setup();

    expect(proxy[member]).toBeUndefined();
  });

  it('uploads through the media manager', async () => {
    const { proxy, storage } = setup();
    const file = Buffer.from('%PDF');

    await expect(proxy.upload(file, 'contract.pdf')).resolves.toMatchObject({ path: 'doc-1.pdf' });
    expect(storage.upload).toHaveBeenCalledWith(file, 'contract.pdf', undefined);
  });

  it('removes a file the plugin uploaded', async () => {
    const { proxy, storage } = setup();

    await proxy.remove('doc-1.pdf');

    expect(storage.remove).toHaveBeenCalledWith('doc-1.pdf', undefined);
  });

  it('refuses to remove a media-library file, looking across every site', async () => {
    const { proxy, storage, db } = setup([{ path: 'logo-abc.png' }]);

    await expect(proxy.remove('logo-abc.png')).rejects.toThrow(/belongs to the media library/);
    expect(storage.remove).not.toHaveBeenCalled();
    expect(db.withPlatformAdmin).toHaveBeenCalled();
  });
});
