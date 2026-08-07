import { RESTController } from '@api/controllers/rest/rest-controller';
import { MediaCollection } from '@fromcode119/media';

/**
 * `MediaCollection` is a CLASS whose static `schema` holds the collection definition — production reads
 * `MediaCollection.schema` (see `packages/api/src/collections/core.ts`). This suite used to hand the
 * CLASS to `RESTController.find`, so `collection.slug` and `collection.fields` were both `undefined`,
 * `QueryHelper.getVirtualTable` threw on `collection.fields.map`, and the controller answered 500.
 *
 * That 500 was a stale fixture, NOT a product bug: verified against the live stack, an authenticated
 * `GET /api/v1/collections/media?limit=5` returns **200** with real media documents. The fixture simply
 * never followed the module when the plain exported object became a class.
 */
describe('Media Collection REST', () => {
  let controller: RESTController;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      find: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      desc: vi.fn().mockReturnValue('desc_order'),
      asc: vi.fn().mockReturnValue('asc_order'),
      eq: vi.fn().mockReturnValue('eq_op'),
      and: vi.fn().mockImplementation((...args) => args),
      or: vi.fn().mockImplementation((...args) => args),
    };
    controller = new RESTController(mockDb);
  });

  it('should successfully build query for media collection', async () => {
    const req: any = { query: { limit: '10' }, user: { roles: ['admin'] } };
    const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };

    await controller.find(MediaCollection.schema as any, req, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalled();
    // The query really reached the database layer for the `media` table — proving the virtual table was
    // built from the schema's fields rather than the request merely failing quietly.
    expect(mockDb.find).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0]).toEqual(expect.objectContaining({ docs: [] }));
  });
});
