import { CollectionReadRedaction } from '@api/services/collection-read-redaction';
import { CollectionAccessPolicyService } from '@api/services/collection-access-policy-service';
import { RestReadController } from '@api/controllers/rest/rest-read-controller';
import { RestConsoleReadController } from '@api/controllers/rest/rest-console-read-controller';
import { CollectionReadOptions } from '@api/services/collection-read-options';

/**
 * A collection opened to the public served every column of every row through the generic reads: the
 * stored access password of a protected post (and its content), a product's cost price, the address of
 * a paid file. Reproduced anonymously against a 0.2.307 stack before this change. These tests fail if a
 * partial reader can see, filter, sort or search a field its collection keeps from them again, or if the
 * console's export and suggestion tools answer anyone who merely browses.
 */
describe('collection read redaction', () => {
  const ADMIN = { id: 1, roles: ['admin'] };
  const CUSTOMER = { id: 3, roles: ['customer'] };
  const collection: any = {
    slug: 'fcp_example_posts',
    pluginSlug: 'example',
    shortSlug: 'posts',
    fields: [
      { name: 'title', type: 'text' },
      { name: 'status', type: 'select' },
      { name: 'content', type: 'richText', withheldWhen: ['accessPassword'] },
      { name: 'excerpt', type: 'text', withheldWhen: ['accessPassword'] },
      { name: 'accessPassword', type: 'text', staffOnly: true },
    ],
  };
  const locked = { id: 1, title: 'Locked', status: 'published', content: 'secret body', excerpt: 'teaser', accessPassword: 'pw' };
  const open = { id: 2, title: 'Open', status: 'published', content: 'public body', excerpt: 'e', accessPassword: '' };

  describe('redact', () => {
    it('strips staff-only fields and holds back what a set sibling guards', () => {
      const [first, second] = CollectionReadRedaction.redact(collection, [locked, open]) as any[];
      expect(first).not.toHaveProperty('accessPassword');
      expect(first.content).toBeNull();
      expect(first.excerpt).toBeNull();
      expect(first.withheldFields).toEqual(['content', 'excerpt']);
      expect(second).not.toHaveProperty('accessPassword');
      expect(second.content).toBe('public body');
      expect(second).not.toHaveProperty('withheldFields');
    });

    it('never mutates the rows it was given', () => {
      CollectionReadRedaction.redact(collection, locked);
      expect(locked.accessPassword).toBe('pw');
      expect(locked.content).toBe('secret body');
    });

    it('leaves the conditional hold-back to the caller when asked (page resolution)', () => {
      const row = CollectionReadRedaction.redact(collection, locked, false) as any;
      expect(row).not.toHaveProperty('accessPassword');
      expect(row.content).toBe('secret body');
    });

    it('treats empty values as unset', () => {
      for (const value of [null, undefined, '', false, [], {}]) expect(CollectionReadRedaction.holdsValue(value)).toBe(false);
      for (const value of ['x', ['a'], { a: 1 }, true, 0, 3]) expect(CollectionReadRedaction.holdsValue(value)).toBe(true);
    });

    it('passes a collection that declares nothing through untouched', () => {
      const plain: any = { slug: 'plain', fields: [{ name: 'title', type: 'text' }] };
      const rows = [{ title: 'a' }];
      expect(CollectionReadRedaction.redact(plain, rows)).toBe(rows);
    });
  });

  describe('assertQueryable', () => {
    it('refuses a filter or sort on a field the reader may not see', () => {
      expect(() => CollectionReadRedaction.assertQueryable(collection, { accessPassword: 'p' })).toThrow(/accessPassword/);
      expect(() => CollectionReadRedaction.assertQueryable(collection, {}, '-accessPassword')).toThrow(/accessPassword/);
      expect(() => CollectionReadRedaction.assertQueryable(collection, { content: 'x' })).toThrow(/content/);
      try { CollectionReadRedaction.assertQueryable(collection, { accessPassword: 'p' }); } catch (error: any) { expect(error.statusCode).toBe(400); }
    });

    it('allows every other field', () => {
      expect(() => CollectionReadRedaction.assertQueryable(collection, { title: 'x', status: 'published' }, '-title')).not.toThrow();
    });
  });

  describe('RestReadController', () => {
    const buildRuntime = (rows: any[]) => ({
      accessPolicy: {
        resolveReadConstraints: vi.fn().mockResolvedValue({}),
        matchesReadConstraints: vi.fn().mockReturnValue(true),
        seesUnpublished: (c: any, req: any) => new CollectionAccessPolicyService().seesUnpublished(c, req),
        readsEverything: (c: any, req: any) => new CollectionAccessPolicyService().readsEverything(c, req),
      },
      localization: { getLocaleContext: vi.fn().mockResolvedValue({}) },
      processor: { filterHiddenFields: vi.fn((_c: any, data: any) => data) },
      logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
      parseRecordIdentifier: (_c: any, id: string) => id,
      db: {
        find: vi.fn().mockResolvedValue(rows),
        findOne: vi.fn().mockResolvedValue(rows[0]),
        count: vi.fn().mockResolvedValue(rows.length),
        eq: vi.fn((column: unknown, value: unknown) => ({ eq: [column, value] })),
        and: vi.fn((...args: unknown[]) => ({ and: args })),
        or: vi.fn((...args: unknown[]) => ({ or: args })),
        asc: vi.fn((column: unknown) => ({ asc: column })),
        desc: vi.fn((column: unknown) => ({ desc: column })),
      },
    });
    const response = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis() }) as any;

    it('a list read redacts for an anonymous reader', async () => {
      const res = response();
      await new RestReadController(buildRuntime([locked]) as any).find(collection, { query: {} } as any, res);
      const doc = res.json.mock.calls[0][0].docs[0];
      expect(doc).not.toHaveProperty('accessPassword');
      expect(doc.content).toBeNull();
    });

    it('a list read gives an administrator everything', async () => {
      const res = response();
      await new RestReadController(buildRuntime([locked]) as any).find(collection, { query: {}, user: ADMIN } as any, res);
      expect(res.json.mock.calls[0][0].docs[0]).toEqual(locked);
    });

    it('a single-record read redacts for a signed-in customer', async () => {
      const res = response();
      await new RestReadController(buildRuntime([locked]) as any)
        .findOne(collection, { params: { id: '1' }, query: {}, user: CUSTOMER } as any, res);
      const doc = res.json.mock.calls[0][0];
      expect(doc).not.toHaveProperty('accessPassword');
      expect(doc.content).toBeNull();
    });

    it('an anonymous filter on a staff-only field is refused, not answered', async () => {
      const runtime = buildRuntime([locked]);
      const res = response();
      await new RestReadController(runtime as any).find(collection, { query: { accessPassword: 'pw' } } as any, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(runtime.db.find).not.toHaveBeenCalled();
    });

    it('a read for page resolution keeps the conditional fields for the gates', async () => {
      const res = response();
      await new RestReadController(buildRuntime([locked]) as any)
        .find(collection, { query: {}, [CollectionReadRedaction.FOR_RESOLUTION]: true } as any, res);
      expect(res.json.mock.calls[0][0].docs[0].content).toBe('secret body');
    });

    it('a read of some fields also reads what withholds them, so a withheld field stays withheld', async () => {
      const runtime = buildRuntime([{ id: 1, content: 'secret body', accessPassword: 'pw' }]);
      const res = response();
      const req: any = { query: {}, [CollectionReadOptions.KEY]: { fields: ['content'], withoutTotal: true } };
      await new RestReadController(runtime as any).find(collection, req, res);
      expect(Object.keys(runtime.db.find.mock.calls[0][1].columns).sort()).toEqual(['accessPassword', 'content', 'id']);
      expect(runtime.db.count).not.toHaveBeenCalled();
      const doc = res.json.mock.calls[0][0].docs[0];
      expect(doc.content).toBeNull();
      expect(doc).not.toHaveProperty('accessPassword');
    });
  });

  describe('RestConsoleReadController', () => {
    const buildRuntime = () => ({
      accessPolicy: { ensureReadsEverything: (c: any, req: any) => new CollectionAccessPolicyService().ensureReadsEverything(c, req) },
      suggestionService: { getSuggestions: vi.fn().mockResolvedValue([{ label: 'Locked', value: 'pw' }]) },
      db: { find: vi.fn().mockResolvedValue([locked]) },
    });
    const response = () => ({ json: vi.fn(), send: vi.fn(), setHeader: vi.fn(), status: vi.fn().mockReturnThis() }) as any;

    it('refuses an anonymous export and suggestion', async () => {
      const runtime = buildRuntime();
      const exported = response();
      await new RestConsoleReadController(runtime as any).export(collection, { query: {} } as any, exported);
      expect(exported.status).toHaveBeenCalledWith(401);
      expect(runtime.db.find).not.toHaveBeenCalled();

      const suggested = response();
      await new RestConsoleReadController(runtime as any)
        .getSuggestions(collection, { query: { q: 'p' }, params: { field: 'accessPassword' } } as any, suggested);
      expect(suggested.status).toHaveBeenCalledWith(401);
      expect(runtime.suggestionService.getSuggestions).not.toHaveBeenCalled();
    });

    it('refuses a signed-in customer with 403', async () => {
      const res = response();
      await new RestConsoleReadController(buildRuntime() as any).export(collection, { query: {}, user: CUSTOMER } as any, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('serves an administrator', async () => {
      const res = response();
      await new RestConsoleReadController(buildRuntime() as any).export(collection, { query: {}, user: ADMIN } as any, res);
      expect(res.json).toHaveBeenCalledWith([locked]);
    });
  });
});
