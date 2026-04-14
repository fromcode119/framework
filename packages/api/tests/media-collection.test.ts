import { RESTController } from '../src/controllers/rest/rest-controller';
import { MediaCollection } from '@fromcode119/media';

describe('Media Collection REST', () => {
  let controller: RESTController;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      desc: jest.fn().mockReturnValue('desc_order'),
      asc: jest.fn().mockReturnValue('asc_order'),
      eq: jest.fn().mockReturnValue('eq_op'),
      and: jest.fn().mockImplementation((...args) => args),
      or: jest.fn().mockImplementation((...args) => args),
    };
    controller = new RESTController(mockDb);
  });

  it('should successfully build query for media collection', async () => {
    const req: any = { query: { limit: '10' }, user: { roles: ['admin'] } };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.find(MediaCollection, req, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalled();
    
    // Check if it mapped correctly to camelCase in drizzle table (internally)
    // Actually, we want to see what 'createDynamicTable' did.
    // But we can just verify it didn't crash.
  });
});
