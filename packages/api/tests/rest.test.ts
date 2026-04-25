import { RESTController } from '../src/controllers/rest/rest-controller';

describe('rest-controller', () => {
  let controller: RESTController;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      dialect: 'postgres',
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
    
    const req: any = { params: { id: '1' }, body: { title: 'New Title' }, user: { roles: ['admin'] } };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.update(mockCollection, req, res);

    expect(mockDb.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  it('create uses string table writes for sqlite collections', async () => {
    mockDb.dialect = 'sqlite';
    mockDb.insert.mockResolvedValue({ id: 1, title: 'Hello' });

    const req: any = { body: { title: 'Hello' }, query: {}, user: { roles: ['admin'] } };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.create(mockCollection, req, res);

    expect(mockDb.insert).toHaveBeenCalledWith('posts', expect.objectContaining({ title: 'Hello' }));
    expect(res.status).toHaveBeenCalledWith(201);
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

  it('blocks anonymous reads of system collections', async () => {
    const systemCollection: any = {
      slug: 'settings',
      system: true,
      fields: [{ name: 'key', type: 'text' }]
    };
    const req: any = { query: {} };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.find(systemCollection, req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockDb.find).not.toHaveBeenCalled();
  });

  it('allows admin reads of system collections', async () => {
    const systemCollection: any = {
      slug: 'users',
      system: true,
      fields: [{ name: 'email', type: 'text' }]
    };

    mockDb.find.mockResolvedValue([{ id: 1, email: 'admin@example.com' }]);
    mockDb.count.mockResolvedValue(1);

    const req: any = { query: {}, user: { roles: ['admin'] } };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.find(systemCollection, req, res);

    expect(mockDb.find).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(401);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it('blocks non-admin reads of system collections', async () => {
    const systemCollection: any = {
      slug: 'users',
      system: true,
      fields: [{ name: 'email', type: 'text' }]
    };
    const req: any = { query: {}, user: { roles: ['editor'] } };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.find(systemCollection, req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockDb.find).not.toHaveBeenCalled();
  });

  it('blocks anonymous writes for generic collections', async () => {
    const req: any = { body: { title: 'Hello' }, query: {} };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.create(mockCollection, req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('allows public reads for non-system collections', async () => {
    mockDb.find.mockResolvedValue([{ id: 1, title: 'Hello' }]);
    mockDb.count.mockResolvedValue(1);

    const req: any = { query: {} };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.find(mockCollection, req, res);

    expect(mockDb.find).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(401);
  });
});
