import { describe, expect, it, vi } from 'vitest';
import { MediaRelationService } from '@core/services/media-relation-service';

/**
 * Hydrating the media a list of records points at cost one `findById` per id — from a plugin, one call
 * across the process boundary for every image of every product on a page. It is one batch lookup now.
 */
describe('MediaRelationService.loadRecords', () => {
  it('resolves every referenced id in one lookup, keyed as referenced', async () => {
    const findByIds = vi.fn(async (ids: number[]) => new Map(ids.filter((id) => id !== 9).map((id) => [String(id), { id, url: `/m/${id}` }])));
    const findById = vi.fn();
    const service = new MediaRelationService({ media: { findByIds, findById } } as any);

    const records = await service.loadRecords([3, '4', { id: 3 }, { mediaId: 9 }, 'not-an-id']);

    expect(findByIds).toHaveBeenCalledTimes(1);
    expect(findByIds).toHaveBeenCalledWith([3, 4, 9]);
    expect(findById).not.toHaveBeenCalled();
    expect([...records.keys()]).toEqual(['3', '4']);
    expect(records.get('4')).toEqual({ id: 4, url: '/m/4' });
  });

  it('asks nothing when nothing is referenced', async () => {
    const findByIds = vi.fn();
    expect((await new MediaRelationService({ media: { findByIds } } as any).loadRecords([null, ''])).size).toBe(0);
    expect(findByIds).not.toHaveBeenCalled();
  });
});
