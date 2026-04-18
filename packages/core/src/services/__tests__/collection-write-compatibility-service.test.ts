import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollectionService } from '../collection-service';
import { CollectionWriteCompatibilityService } from '../collection-write-compatibility-service';

describe('CollectionWriteCompatibilityService', () => {
  let collectionService: CollectionService;
  let service: CollectionWriteCompatibilityService;

  beforeEach(() => {
    collectionService = new CollectionService();
    service = new CollectionWriteCompatibilityService(collectionService);
  });

  it('retries collection update after removing unsupported field variants', async () => {
    const collection = {
      slug: 'products',
      update: vi
        .fn()
        .mockRejectedValueOnce(new Error('column "available_delivery_types" does not exist'))
        .mockResolvedValueOnce({ id: 1, slug: 'monthly' }),
    };

    const result = await service.updateCollection(
      collection as any,
      { id: 1 },
      {
        availableDeliveryTypes: [],
        available_delivery_types: [],
        title: 'Monthly',
      },
    );

    expect(result).toEqual({ id: 1, slug: 'monthly' });
    expect(collection.update).toHaveBeenLastCalledWith(
      { id: 1 },
      { title: 'Monthly' },
    );
  });

  it('returns existing record when upsert payload becomes empty after compatibility filtering', async () => {
    vi.spyOn(collectionService, 'findByCandidates').mockResolvedValue({ id: 1, slug: 'monthly' });
    const collection = {
      slug: 'products',
      update: vi.fn().mockRejectedValueOnce(new Error('column "available_delivery_types" does not exist')),
      insert: vi.fn(),
    };

    const result = await service.findAndUpsert(
      collection as any,
      ['monthly'],
      {
        availableDeliveryTypes: [],
        available_delivery_types: [],
      },
      { targetKey: 'products' },
    );

    expect(result).toEqual({ record: { id: 1, slug: 'monthly' }, created: false });
    expect(collection.update).toHaveBeenCalledTimes(1);
    expect(collection.insert).not.toHaveBeenCalled();
  });

  it('retries raw db insert after removing unsupported field', async () => {
    const db = {
      insert: vi
        .fn()
        .mockRejectedValueOnce(new Error('no column named provider'))
        .mockResolvedValueOnce({ id: 10 }),
    };

    const result = await service.insertRecord(
      db as any,
      'media',
      {
        provider: 'local',
        filename: 'test.jpg',
      },
    );

    expect(result).toEqual({ id: 10 });
    expect(db.insert).toHaveBeenLastCalledWith('media', { filename: 'test.jpg' });
  });
});
