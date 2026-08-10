import { ContentPreviewAccessUtils } from '@fromcode119/core';
import { SystemRuntimeController } from '@api/controllers/system/system-runtime-controller';
import { RestReadController } from '@api/controllers/rest/rest-read-controller';

/**
 * Regression guard for the preview/draft access bug found on 2026-08-10.
 *
 * `preview: isAdmin || isPreview` (and its `!isAdmin && !isPreview` twin in the REST read path) took
 * `isPreview` straight from the query string, so ANY unauthenticated visitor could read unpublished
 * content with `?preview=1` / `?draft=1`. Reproduced against the running stack: the draft page
 * `zz-temp-i18n-verify-product-block` answered 404 anonymously and 200 with `?preview=1&draft=1`.
 *
 * The gate is now authorization-only. These tests fail if a query parameter ever grants preview again.
 */
describe('preview access gate', () => {
  const DRAFT_QUERY = { slug: 'secret-draft', preview: '1', draft: '1' };
  const ADMIN = { id: 1, roles: ['admin'], permissions: ['*'] };
  const EDITOR = { id: 2, roles: ['editor'], permissions: ['content:read', 'content:write'] };
  const CUSTOMER = { id: 3, roles: ['customer'], permissions: [] };

  describe('ContentPreviewAccessUtils.canPreviewUnpublished', () => {
    it('denies anonymous requests', () => {
      expect(ContentPreviewAccessUtils.canPreviewUnpublished(undefined)).toBe(false);
      expect(ContentPreviewAccessUtils.canPreviewUnpublished(null)).toBe(false);
    });

    it('denies a signed-in customer with no content permission', () => {
      expect(ContentPreviewAccessUtils.canPreviewUnpublished(CUSTOMER)).toBe(false);
    });

    it('grants the admin role and the global permission', () => {
      expect(ContentPreviewAccessUtils.canPreviewUnpublished(ADMIN)).toBe(true);
      expect(ContentPreviewAccessUtils.canPreviewUnpublished({ roles: [], permissions: ['*'] })).toBe(true);
    });

    it('grants content:read, including via a hierarchical wildcard', () => {
      expect(ContentPreviewAccessUtils.canPreviewUnpublished(EDITOR)).toBe(true);
      expect(ContentPreviewAccessUtils.canPreviewUnpublished({ roles: ['x'], permissions: ['content:*'] })).toBe(true);
    });

    it('reads roles/permissions stored as JSON strings, and is case-insensitive', () => {
      expect(ContentPreviewAccessUtils.canPreviewUnpublished({ roles: '["Admin"]' })).toBe(true);
      expect(ContentPreviewAccessUtils.canPreviewUnpublished({ permissions: '["content:read"]' })).toBe(true);
    });
  });

  describe('SystemRuntimeController.resolveSlug', () => {
    /** Stands in for route resolution: an unpublished doc exists, readable only in preview. */
    const buildRuntime = () => ({
      resolution: {
        resolveSlug: vi.fn(async (_slug: string, options: any) =>
          (options?.preview ? { type: 'pages', plugin: 'system', doc: { id: 46, slug: 'secret-draft', status: 'draft' } } : null)),
      },
    });

    const buildResponse = () => {
      const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };
      return res;
    };

    it('404s an anonymous request that asks for preview via the query string', async () => {
      const runtime = buildRuntime();
      const res = buildResponse();

      await new SystemRuntimeController(runtime as any).resolveSlug({ query: DRAFT_QUERY } as any, res);

      expect(runtime.resolution.resolveSlug).toHaveBeenCalledWith('secret-draft', expect.objectContaining({ preview: false }));
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
    });

    it('404s a signed-in customer that asks for preview via the query string', async () => {
      const runtime = buildRuntime();
      const res = buildResponse();

      await new SystemRuntimeController(runtime as any).resolveSlug({ query: DRAFT_QUERY, user: CUSTOMER } as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('resolves the draft for an admin session', async () => {
      const runtime = buildRuntime();
      const res = buildResponse();

      await new SystemRuntimeController(runtime as any).resolveSlug({ query: DRAFT_QUERY, user: ADMIN } as any, res);

      expect(runtime.resolution.resolveSlug).toHaveBeenCalledWith('secret-draft', expect.objectContaining({ preview: true }));
      expect(res.status).not.toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ doc: expect.objectContaining({ status: 'draft' }) }));
    });

    it('resolves the draft for an editor session (content:read)', async () => {
      const runtime = buildRuntime();
      const res = buildResponse();

      await new SystemRuntimeController(runtime as any).resolveSlug({ query: DRAFT_QUERY, user: EDITOR } as any, res);

      expect(runtime.resolution.resolveSlug).toHaveBeenCalledWith('secret-draft', expect.objectContaining({ preview: true }));
      expect(res.status).not.toHaveBeenCalledWith(404);
    });
  });

  describe('RestReadController', () => {
    const collection: any = {
      slug: 'pages',
      fields: [{ name: 'title', type: 'text' }, { name: 'status', type: 'select' }],
    };

    const buildRuntime = (draft: Record<string, unknown>) => ({
      accessPolicy: {
        resolveReadConstraints: vi.fn().mockResolvedValue({}),
        matchesReadConstraints: vi.fn().mockReturnValue(true),
      },
      localization: { getLocaleContext: vi.fn().mockResolvedValue({}) },
      processor: { filterHiddenFields: vi.fn((_collection: any, rows: any) => rows) },
      versioningService: {},
      suggestionService: {},
      activityService: {},
      logger: { error: vi.fn(), warn: vi.fn() },
      parseRecordIdentifier: (_collection: any, id: string) => id,
      db: {
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(draft),
        count: vi.fn().mockResolvedValue(0),
        eq: vi.fn((column: unknown, value: unknown) => ({ eq: [column, value] })),
        and: vi.fn((...args: unknown[]) => ({ and: args })),
        or: vi.fn((...args: unknown[]) => ({ or: args })),
        asc: vi.fn((column: unknown) => ({ asc: column })),
        desc: vi.fn((column: unknown) => ({ desc: column })),
      },
    });

    it('findOne 404s a draft for an anonymous ?preview=1 request', async () => {
      const runtime = buildRuntime({ id: 46, slug: 'secret-draft', status: 'draft' });
      const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await new RestReadController(runtime as any)
        .findOne(collection, { params: { id: '46' }, query: { preview: '1', draft: '1' } } as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Not found (draft)' });
    });

    it('findOne returns the draft for an admin session', async () => {
      const runtime = buildRuntime({ id: 46, slug: 'secret-draft', status: 'draft' });
      const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await new RestReadController(runtime as any)
        .findOne(collection, { params: { id: '46' }, query: {}, user: ADMIN } as any, res);

      expect(res.status).not.toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }));
    });

    it('find keeps the published-only filter for an anonymous ?preview=1 list read', async () => {
      const runtime = buildRuntime({});
      const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await new RestReadController(runtime as any)
        .find(collection, { query: { preview: '1', draft: '1' } } as any, res);

      expect(runtime.db.eq).toHaveBeenCalledWith(expect.anything(), 'published');
    });

    it('find drops the published-only filter for an admin session', async () => {
      const runtime = buildRuntime({});
      const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await new RestReadController(runtime as any).find(collection, { query: {}, user: ADMIN } as any, res);

      expect(runtime.db.eq).not.toHaveBeenCalledWith(expect.anything(), 'published');
    });
  });
});
