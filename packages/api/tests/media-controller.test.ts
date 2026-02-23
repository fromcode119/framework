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
    const selectMock = jest.fn().mockReturnValue(
      buildChain([
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
      ])
    );

    const mockDb = { select: selectMock } as any;
    const controller = new MediaController({ db: { drizzle: mockDb } } as any, {
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
    const selectMock = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('missing column');
      })
      .mockReturnValue(
        buildChain([
          {
            id: 2,
            filename: 'file.png',
            mimeType: 'image/png',
            fileSize: 456,
            path: 'uploads/file.png',
            createdAt: new Date().toISOString(),
          },
        ])
      );

    const mockDb = { select: selectMock } as any;
    const controller = new MediaController({ db: { drizzle: mockDb } } as any, {
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
});
