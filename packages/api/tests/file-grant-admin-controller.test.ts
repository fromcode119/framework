import { describe, expect, it } from 'vitest';
import { FileGrantAdminController } from '@api/controllers/file-sharing/file-grant-admin-controller';

/**
 * The router hands a controller's methods to Express bare. As a plain class this controller's methods
 * then read `this.db` off undefined, so "who holds this file" answered 500 for every file.
 */
describe('FileGrantAdminController', () => {
  it('lists a file\'s grants when its method is called without a receiver', async () => {
    const db = { find: async () => [{ id: 5, title: 'Banners', media_ids: [2] }] };
    const grants = { listGrantsForShare: async () => [{ id: 1, email: 'maria@example.test' }] };
    const controller = new FileGrantAdminController(db, grants as any);
    const { listGrantsForMedia } = controller;

    let payload: any = null;
    const res: any = { json: (body: any) => { payload = body; return res; }, status: () => res };
    await listGrantsForMedia({ params: { mediaId: '2' } }, res);

    expect(payload?.data).toHaveLength(1);
    expect(payload.data[0].email).toBe('maria@example.test');
    expect(payload.data[0].shareId).toBe(5);
  });
});
