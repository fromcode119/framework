import { RESTController } from '../src/controllers/rest-controller';

describe('rest-controller', () => {
  let controller: RESTController;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      find: jest.fn(),
      findOne: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
      desc: jest.fn().mockImplementation((col) => ({ desc: col })),
      asc: jest.fn().mockImplementation((col) => ({ asc: col })),
      eq: jest.fn().mockImplementation((col, val) => ({ eq: [col, val] })),
      and: jest.fn().mockImplementation((...args) => ({ and: args })),
      or: jest.fn().mockImplementation((...args) => ({ or: args })),
    };
    controller = new RESTController(mockDb);
  });

  const mockCollection: any = {
    slug: 'posts',
    fields: [
      { name: 'title', type: 'text' },
      { name: 'content', type: 'text' }
    ]
  };

  it('findOne retrieves a record by ID', async () => {
    mockDb.findOne.mockResolvedValue({ id: 1, title: 'Hello' });
    
    const req: any = { params: { id: '1' }, query: {} };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.findOne(mockCollection, req, res);

    expect(mockDb.findOne).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Hello' }));
  });

  it('update modifies a record', async () => {
    mockDb.findOne.mockResolvedValue({ id: '1', title: 'Old Title' });
    mockDb.update.mockResolvedValue({ id: '1', title: 'New Title' });
    
    const req: any = { params: { id: '1' }, body: { title: 'New Title' } };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.update(mockCollection, req, res);

    expect(mockDb.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  it('find maps page+limit to offset when offset is not provided', async () => {
    mockDb.find.mockResolvedValue([]);
    mockDb.count.mockResolvedValue(25);

    const req: any = {
      query: { page: '3', limit: '10', sort: '-createdAt' },
      user: { roles: ['admin'] }
    };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.find(mockCollection, req, res);

    expect(mockDb.find).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        limit: 10,
        offset: 20
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        offset: 20,
        page: 3
      })
    );
  });
});
