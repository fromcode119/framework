import { RESTController } from '../src/controllers/RESTController';

describe('RESTController', () => {
  let controller: RESTController;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      find: jest.fn(),
      findOne: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(1)
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
    mockDb.update.mockResolvedValue({ id: '1', title: 'New Title' });
    
    const req: any = { params: { id: '1' }, body: { title: 'New Title' } };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.update(mockCollection, req, res);

    expect(mockDb.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });
});
