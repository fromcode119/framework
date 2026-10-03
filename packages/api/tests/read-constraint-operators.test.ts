import { ReadConstraintOperators } from '@api/services/read-constraint-operators';
import { CollectionAccessPolicyService } from '@api/services/collection-access-policy-service';
import { RestReadController } from '@api/controllers/rest/rest-read-controller';

/**
 * A read rule could only say `field = value`, so "not hidden", "no longer scheduled" and "not switched
 * off" could not be stated, and a public collection listed those rows to every visitor. These tests
 * pin the two comparisons a rule may now use, on the list read (SQL) and the single-record read (JS).
 */
describe('read constraint operators', () => {
  const now = '2026-10-03T12:00:00.000Z';
  const rule = { visibility: { $ne: 'hidden' }, publishAt: { $lte: now, $orNull: true }, status: 'published' };

  it('tells comparisons from exact values', () => {
    expect(ReadConstraintOperators.split(rule)).toEqual({
      equalities: { status: 'published' },
      operators: { visibility: { $ne: 'hidden' }, publishAt: { $lte: now, $orNull: true } },
    });
    expect(ReadConstraintOperators.isOperator({ $orNull: true })).toBe(false);
    expect(ReadConstraintOperators.isOperator({ $gt: 1 })).toBe(false);
    expect(ReadConstraintOperators.isOperator(new Date())).toBe(false);
  });

  it('a single record is checked the same way', () => {
    const policy = new CollectionAccessPolicyService();
    expect(policy.matchesReadConstraints({ visibility: 'public', publishAt: null, status: 'published' }, rule)).toBe(true);
    expect(policy.matchesReadConstraints({ visibility: 'hidden', publishAt: null, status: 'published' }, rule)).toBe(false);
    expect(policy.matchesReadConstraints({ visibility: 'public', publishAt: '2026-11-01T00:00:00Z', status: 'published' }, rule)).toBe(false);
    expect(policy.matchesReadConstraints({ visibility: 'public', publishAt: new Date('2026-09-01'), status: 'published' }, rule)).toBe(true);
    expect(policy.matchesReadConstraints({ active: null }, { active: { $ne: false } })).toBe(true);
    expect(policy.matchesReadConstraints({ active: false }, { active: { $ne: false } })).toBe(false);
  });

  it('a list read sends the comparisons as SQL, never as an equality on an object', async () => {
    const collection: any = { slug: 'fcp_example_items', fields: [{ name: 'visibility', type: 'select' }, { name: 'publishAt', type: 'date' }] };
    const and = vi.fn((...args: unknown[]) => ({ and: args }));
    const runtime: any = {
      accessPolicy: {
        resolveReadConstraints: vi.fn().mockResolvedValue({ visibility: { $ne: 'hidden' } }),
        seesUnpublished: vi.fn().mockResolvedValue(false),
        readsEverything: vi.fn().mockResolvedValue(false),
      },
      localization: { getLocaleContext: vi.fn().mockResolvedValue({}) },
      processor: { filterHiddenFields: vi.fn((_c: any, rows: any) => rows) },
      logger: { error: vi.fn(), debug: vi.fn() },
      db: {
        find: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0),
        eq: vi.fn((column: unknown, value: unknown) => ({ eq: [column, value] })),
        and, or: vi.fn(), asc: vi.fn(), desc: vi.fn((column: unknown) => ({ desc: column })),
      },
    };
    const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    const built = vi.spyOn(ReadConstraintOperators, 'buildClause');
    await new RestReadController(runtime).find(collection, { query: {} }, res);
    expect(built).toHaveBeenCalledWith(runtime.db, expect.anything(), { visibility: { $ne: 'hidden' } });
    expect(runtime.db.eq).not.toHaveBeenCalledWith(expect.anything(), { $ne: 'hidden' });
    expect(res.status).not.toHaveBeenCalled();
  });
});
