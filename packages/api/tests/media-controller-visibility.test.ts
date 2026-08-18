import { MediaController } from '@api/controllers/media-controller';
import { MediaManager } from '@fromcode119/media';

/**
 * The property under test throughout: a PRIVATE file never leaves this controller carrying a public
 * URL. The private driver's bytes live outside the statically served tree, so any URL published for
 * one would be either a 404 or — far worse, if the directory were ever misconfigured — a live link
 * that no route guard sits in front of.
 */
describe('media-controller visibility', () => {
  const buildResponse = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis() }) as any;

  const buildDb = (rows: any[]) => ({
    find: vi.fn().mockResolvedValue(rows),
    desc: vi.fn().mockReturnValue('desc_order'),
    asc: vi.fn().mockReturnValue('asc_order'),
  }) as any;

  /** Real managers over fake drivers, so space routing and URL suppression are exercised for real. */
  const fakeDriver = () => ({
    provider: 'local',
    getUrl: (p: string) => `mock/${p}`,
    save: vi.fn().mockResolvedValue('f.pdf'),
    read: vi.fn(), stream: vi.fn(), delete: vi.fn(),
  }) as any;

  const buildManager = (withPrivate = false): any => new MediaManager({
    [MediaManager.PUBLIC_SPACE]: fakeDriver(),
    ...(withPrivate ? { private: fakeDriver() } : {}),
  });

  const publicManager = buildManager();

  describe('listFiles', () => {
    const row = (over: Record<string, unknown>) => ({
      id: 1, filename: 'f.pdf', originalName: 'f.pdf', mimeType: 'application/pdf', fileSize: 1,
      path: 'f.pdf', folderId: null, createdAt: '', updatedAt: '', ...over,
    });

    it('publishes no url for a private file', async () => {
      const controller = new MediaController({ db: buildDb([row({ visibility: 'private' })]) } as any, publicManager);
      const res = buildResponse();

      await controller.listFiles({ query: {} } as any, res);

      const [payload] = res.json.mock.calls[0];
      expect(payload[0].visibility).toBe('private');
      expect(payload[0].url).toBeNull();
      expect(payload[0].optimizedUrl).toBeNull();
    });

    it('treats a row with no visibility column as public', async () => {
      // The fallback query omits the column, and rows written before it existed hold NULL. Those files
      // ARE public — their bytes sit under a static mount — so reading them as private would claim a
      // protection they do not have.
      const controller = new MediaController({ db: buildDb([row({})]) } as any, publicManager);
      const res = buildResponse();

      await controller.listFiles({ query: {} } as any, res);

      const [payload] = res.json.mock.calls[0];
      expect(payload[0].visibility).toBe('public');
      expect(payload[0].url).toBe('/mock/f.pdf');
    });

    it('still publishes the optimized url for a public file', async () => {
      const controller = new MediaController(
        { db: buildDb([row({ visibility: 'public', optimizedPath: 'f.webp' })]) } as any,
        publicManager,
      );
      const res = buildResponse();

      await controller.listFiles({ query: {} } as any, res);

      expect(res.json.mock.calls[0][0][0].optimizedUrl).toBe('/mock/f.webp');
    });
  });

  describe('upload', () => {
    const buildUploadDeps = () => {
      const insert = vi.fn().mockImplementation((_t: string, values: any) => Promise.resolve({ id: 7, ...values }));
      return { manager: { db: { insert } } as any, insert };
    };

    const req = (visibility?: string) => ({
      file: { buffer: Buffer.from('x'), originalname: 'f.pdf' },
      body: visibility === undefined ? {} : { visibility },
    }) as any;

    it('defaults to public and persists that', async () => {
      const { manager, insert } = buildUploadDeps();
      const res = buildResponse();

      await new MediaController(manager, buildManager()).upload(req(), res);

      expect(insert.mock.calls[0][1].visibility).toBe('public');
      expect(res.json.mock.calls[0][0].url).toBe('/mock/f.pdf');
    });

    it('stores a private upload in the private space and publishes no url', async () => {
      const { manager, insert } = buildUploadDeps();
      const media = buildManager(true);
      const res = buildResponse();

      await new MediaController(manager, media).upload(req('private'), res);

      // The PUBLIC driver must not have been written to — that is the whole assertion.
      expect(media.driver.save).not.toHaveBeenCalled();
      expect(insert.mock.calls[0][1].visibility).toBe('private');
      expect(res.json.mock.calls[0][0].url).toBeNull();
    });

    it('refuses a private upload when private storage is not configured', async () => {
      // Falling back to the public space here would write the file to a permanent public URL while
      // recording it as private — the exact lie this feature exists to prevent.
      const { manager, insert } = buildUploadDeps();
      const media = buildManager();
      const res = buildResponse();

      await new MediaController(manager, media).upload(req('private'), res);

      expect(media.driver.save).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('reads an unknown visibility value as public rather than guessing', async () => {
      const { manager, insert } = buildUploadDeps();
      const res = buildResponse();

      await new MediaController(manager, buildManager()).upload(req('sort-of-secret'), res);

      expect(insert.mock.calls[0][1].visibility).toBe('public');
    });
  });
});
