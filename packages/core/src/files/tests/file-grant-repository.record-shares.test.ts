import { describe, expect, it } from 'vitest';
import { FileGrantRepository } from '@core/files/file-grant-repository';

class DbFixture {
  readonly inserted: Array<{ table: string; values: Record<string, unknown> }> = [];
  private readonly row: Record<string, unknown> | null;

  constructor(row: Record<string, unknown> | null = null) {
    this.row = row;
  }

  async insert(table: string, values: Record<string, unknown>): Promise<{ id: number }> {
    this.inserted.push({ table, values });
    return { id: 1 };
  }

  async findOne(): Promise<Record<string, unknown> | null> {
    return this.row;
  }
}

describe('FileGrantRepository and shared records', () => {
  it('stores what a share points at, alongside its files', async () => {
    const db = new DbFixture();
    const repository = new FileGrantRepository(db as any);

    await repository.createShare({
      title: 'Rate card for Acme',
      message: '',
      mediaIds: [4],
      resourceType: 'hub.candidate',
      resourceIds: ['c-17', 'c-22'],
      createdBy: 3,
    });

    expect(db.inserted[0].values).toMatchObject({
      media_ids: '[4]',
      resource_type: 'hub.candidate',
      resource_ids: '["c-17","c-22"]',
    });
  });

  it('reads a plain file share back with no records attached, exactly as before', async () => {
    const db = new DbFixture({ id: 9, title: 'Photos', message: '', media_ids: '[1,2]', created_by: 3 });
    const share = await new FileGrantRepository(db as any).findShare(9);

    expect(share?.mediaIds).toEqual([1, 2]);
    expect(share?.resourceType).toBe('');
    expect(share?.resourceIds).toEqual([]);
  });

  it('keeps record ids as strings, because a plugin key need not be numeric', async () => {
    const db = new DbFixture({ id: 9, title: 'Profiles', message: '', media_ids: '[]', resource_type: 'hub.candidate', resource_ids: '["c-17","c-22"]', created_by: null });
    const share = await new FileGrantRepository(db as any).findShare(9);

    expect(share?.resourceType).toBe('hub.candidate');
    expect(share?.resourceIds).toEqual(['c-17', 'c-22']);
  });

  it('reads a corrupt list as empty rather than throwing', async () => {
    const db = new DbFixture({ id: 9, title: 'Broken', message: '', media_ids: 'not json', resource_ids: 'not json', created_by: null });
    const share = await new FileGrantRepository(db as any).findShare(9);

    expect(share?.mediaIds).toEqual([]);
    expect(share?.resourceIds).toEqual([]);
  });
});
