import { MediaController } from '../src/controllers/media-controller';

describe('media-controller.listFiles', () => {
  const buildResponse = () => {
    const res: any = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    return res;
  };

  const buildChain = (result: any[]) => ({
    from: () => ({
      where: () => ({
        orderBy: () => Promise.resolve(result),
      }),
    }),
  });

  it('returns files with url using full column set', async () => {
    const mockFiles = [
      {
        id: 1,
        filename: 'file.jpg',
        originalName: 'file.jpg',
        mimeType: 'image/jpeg',
        fileSize: 123,
        width: 10,
        height: 10,
        alt: null,
        caption: null,
        path: 'uploads/file.jpg',
        folderId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const mockDb = { 
      find: jest.fn().mockResolvedValue(mockFiles),
      desc: jest.fn().mockReturnValue('desc_order'),
      asc: jest.fn().mockReturnValue('asc_order'),
    } as any;
    
    const controller = new MediaController({ db: mockDb } as any, {
      driver: { getUrl: () => 'mock-url' },
    } as any);

    const res = buildResponse();
    await controller.listFiles({ query: {} } as any, res as any);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ url: '/mock-url', filename: 'file.jpg' }),
      ])
    );
  });

  it('falls back to basic column set when full select fails', async () => {
    const mockFiles = [
      {
        id: 2,
        filename: 'file.png',
        mimeType: 'image/png',
        fileSize: 456,
        path: 'uploads/file.png',
        createdAt: new Date().toISOString(),
      },
    ];

    const findMock = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('missing column');
      })
      .mockResolvedValue(mockFiles);

    const mockDb = { 
      find: findMock,
      desc: jest.fn().mockReturnValue('desc_order'),
      asc: jest.fn().mockReturnValue('asc_order'),
    } as any;

    const controller = new MediaController({ db: mockDb } as any, {
      driver: { getUrl: () => 'mock-url' },
    } as any);

    const res = buildResponse();
    await controller.listFiles({ query: {} } as any, res as any);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ url: '/mock-url', filename: 'file.png' }),
      ])
    );
  });

  it('returns api-host media urls when the request comes through the admin host', async () => {
    const mockFiles = [
      {
        id: 3,
        filename: 'file.jpg',
        originalName: 'file.jpg',
        mimeType: 'image/jpeg',
        fileSize: 123,
        path: 'uploads/file.jpg',
        createdAt: new Date().toISOString(),
      },
    ];

    const mockDb = {
      find: jest.fn().mockResolvedValue(mockFiles),
      desc: jest.fn().mockReturnValue('desc_order'),
      asc: jest.fn().mockReturnValue('asc_order'),
    } as any;

    const controller = new MediaController({ db: mockDb } as any, {
      driver: { getUrl: () => '/uploads/file.jpg' },
    } as any);

    const req = {
      query: {},
      protocol: 'http',
      get: jest.fn((header: string) => {
        if (header === 'x-forwarded-host') return 'admin.framework.local';
        if (header === 'x-forwarded-proto') return 'http';
        return undefined;
      }),
    } as any;

    const res = buildResponse();
    await controller.listFiles(req, res as any);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          url: 'http://api.framework.local/uploads/file.jpg',
          filename: 'file.jpg',
        }),
      ]),
    );
  });
});
