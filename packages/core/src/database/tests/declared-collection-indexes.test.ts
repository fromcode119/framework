import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeclaredIndexEnsurer } from '@core/database/declared-index-ensurer';
import { TenantMode } from '@core/tenant/tenant-mode';
import { EntitySchemaPlanService } from '@core/database/entity-schema-plan-service';
import { SchemaManager } from '@core/database/schema-manager';
import type { ICollection } from '@core/collections/interfaces/collection.interface';

const collection: ICollection = {
  slug: 'fcp_lms_progress',
  fields: [
    { name: 'userId', type: 'number' },
    { name: 'lessonId', type: 'number' },
    { name: 'status', type: 'text' },
  ],
  indexes: [
    { fields: ['userId', 'lessonId'], unique: true },
    { name: 'fcp_lms_progress_status', fields: ['status'] },
    { fields: [] },
  ],
};

const logger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) as any;

describe('declared collection indexes', () => {
  it('plans snake_case columns and schema-unique names, skipping empty declarations', () => {
    const plan = new EntitySchemaPlanService().buildPlan(collection, true, []);
    expect(plan.declaredIndexes).toEqual([
      { name: 'fcp_lms_progress_user_id_lesson_id_idx', columns: ['user_id', 'lesson_id'], unique: true },
      { name: 'fcp_lms_progress_status', columns: ['status'], unique: false },
    ]);
  });

  it('creates every declared index through createIndexIfMissing', async () => {
    const db: any = { createIndexIfMissing: vi.fn(async () => undefined), supportsTenantIsolation: () => false };
    const plan = new EntitySchemaPlanService().buildPlan(collection, true, []);
    await new DeclaredIndexEnsurer(db, logger()).ensure(plan);

    expect(db.createIndexIfMissing).toHaveBeenCalledTimes(2);
    expect(db.createIndexIfMissing).toHaveBeenCalledWith(
      'fcp_lms_progress', 'fcp_lms_progress_user_id_lesson_id_idx', ['user_id', 'lesson_id'], { unique: true, where: undefined });
    expect(db.createIndexIfMissing).toHaveBeenCalledWith(
      'fcp_lms_progress', 'fcp_lms_progress_status', ['status'], { unique: false, where: undefined });
  });

  it('is idempotent: a second sync issues the same IF-MISSING calls and changes nothing', async () => {
    const created = new Set<string>();
    const db: any = { supportsTenantIsolation: () => false, createIndexIfMissing: vi.fn(async (_t: string, name: string) => { created.add(name); }) };
    const plan = new EntitySchemaPlanService().buildPlan(collection, true, []);
    const ensurer = new DeclaredIndexEnsurer(db, logger());
    await ensurer.ensure(plan);
    await ensurer.ensure(plan);
    expect(created.size).toBe(2);
  });

  describe('on a deployment with tenants', () => {
    beforeEach(() => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true }));
    afterEach(() => TenantMode.reset());

    it('leads a unique index with tenant_id (after making sure the column exists) and leaves the others alone', async () => {
      const calls: string[] = [];
      const db: any = {
        supportsTenantIsolation: () => true,
        tenantIsolation: { addTenantColumn: vi.fn(async () => { calls.push('column'); }) },
        createIndexIfMissing: vi.fn(async (_t: string, name: string) => { calls.push(name); }),
      };
      const plan = new EntitySchemaPlanService().buildPlan(collection, true, []);
      await new DeclaredIndexEnsurer(db, logger()).ensure(plan);

      expect(calls).toEqual(['column', 'fcp_lms_progress_user_id_lesson_id_idx', 'fcp_lms_progress_status']);
      expect(db.createIndexIfMissing).toHaveBeenCalledWith(
        'fcp_lms_progress', 'fcp_lms_progress_user_id_lesson_id_idx', ['tenant_id', 'user_id', 'lesson_id'], { unique: true, where: undefined });
      expect(db.createIndexIfMissing).toHaveBeenCalledWith(
        'fcp_lms_progress', 'fcp_lms_progress_status', ['status'], { unique: false, where: undefined });
    });

    it('a refused unique lists the conflicting key groups (read with isolation lifted), skips it, and still builds the next index', async () => {
      const log = logger();
      const readAsOwner = vi.fn(async (_t: string, read: () => Promise<unknown>) => read());
      const db: any = {
        supportsTenantIsolation: () => true,
        tenantIsolation: { addTenantColumn: async () => undefined, readAsOwner },
        createIndexIfMissing: vi.fn()
          .mockRejectedValueOnce(new Error('could not create unique index: Key (tenant_id, user_id, lesson_id)=(a, 1, 2) is duplicated'))
          .mockResolvedValueOnce(undefined),
        aggregate: vi.fn(async () => [
          { tenant_id: 'a', user_id: 1, lesson_id: 2, copies: 3 },
          { tenant_id: 'a', user_id: 1, lesson_id: null, copies: 2 },
          { tenant_id: 'b', user_id: 9, lesson_id: 9, copies: 1 },
        ]),
        delete: vi.fn(),
      };
      const plan = new EntitySchemaPlanService().buildPlan(collection, true, []);
      await expect(new DeclaredIndexEnsurer(db, log).ensure(plan)).resolves.toBeUndefined();

      expect(db.createIndexIfMissing).toHaveBeenCalledTimes(2);
      expect(readAsOwner).toHaveBeenCalledWith('fcp_lms_progress', expect.any(Function));
      expect(db.aggregate.mock.calls[0][1].groupBy).toEqual(['tenant_id', 'user_id', 'lesson_id']);
      expect(log.warn).toHaveBeenCalledTimes(1);
      const message = log.warn.mock.calls[0][0] as string;
      expect(message).toMatch(/UNIQUE index "fcp_lms_progress_user_id_lesson_id_idx".*NOT created and is skipped/);
      expect(message).toContain('1 key group(s) hold duplicate rows: (tenant_id=a, user_id=1, lesson_id=2) x3');
      expect(message).toContain('No row was changed');
      expect(db.delete).not.toHaveBeenCalled();
    });
  });

  it('a failing unique with no tenants warns with the groups and does not throw', async () => {
    const log = logger();
    const db: any = {
      supportsTenantIsolation: () => false,
      createIndexIfMissing: vi.fn().mockRejectedValueOnce(new Error('duplicate key')).mockResolvedValueOnce(undefined),
      aggregate: vi.fn(async () => [{ user_id: 4, lesson_id: 5, copies: 2 }]),
    };
    const plan = new EntitySchemaPlanService().buildPlan(collection, true, []);
    await expect(new DeclaredIndexEnsurer(db, log).ensure(plan)).resolves.toBeUndefined();

    expect(db.createIndexIfMissing).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn.mock.calls[0][0]).toContain('(user_id=4, lesson_id=5) x2');
  });

  it('plans a partial index: conditions on snake_case columns, named apart from the plain one', () => {
    const plan = new EntitySchemaPlanService().buildPlan({
      slug: 'fcp_analytics_visits',
      fields: [{ name: 'visitorHash', type: 'text' }, { name: 'endedAt', type: 'date' }, { name: 'kind', type: 'text' }],
      indexes: [{ fields: ['visitorHash'], unique: true, where: { endedAt: null, kind: { not: 'bot' } } }],
    } as ICollection, true, []);
    expect(plan.declaredIndexes).toEqual([{
      name: 'fcp_analytics_visits_visitor_hash_where_ended_at_kind_idx',
      columns: ['visitor_hash'],
      unique: true,
      where: [{ column: 'ended_at', value: null }, { column: 'kind', value: 'bot', negate: true }],
    }]);
  });

  it('keeps a long generated name under the 63-byte identifier limit, deterministically and distinct', () => {
    const make = (field: string) => new EntitySchemaPlanService().buildPlan({
      slug: 'fcp_subscriptions_subscription_events',
      fields: [{ name: field, type: 'text' }],
      indexes: [{ fields: [field] }],
    } as ICollection, true, []).declaredIndexes[0].name;
    const a = make('someVeryLongFieldNameNumberOne');
    expect(a.length).toBeLessThanOrEqual(63);
    expect(make('someVeryLongFieldNameNumberOne')).toBe(a);
    expect(make('someVeryLongFieldNameNumberTwo')).not.toBe(a);
  });

  it('creates indexes before tenant isolation, so the sweep scopes a unique one per tenant', async () => {
    const order: string[] = [];
    const db: any = {
      dialect: 'postgres',
      tableExists: async () => true,
      getColumns: async () => ['id', 'user_id', 'lesson_id', 'status'],
      createIndexIfMissing: async () => { order.push('index'); },
      supportsTenantIsolation: () => true,
    };
    const manager: any = new SchemaManager(db);
    manager.declared.ensureDeclaredUniques = async () => undefined;
    manager.declared.relaxDeclaredOptionals = async () => undefined;
    manager.declared.convertTextPointInTimeColumns = async () => undefined;
    manager.declared.convertTextBooleanColumns = async () => undefined;
    manager.declared.ensureTimestampDefaults = async () => undefined;
    manager.declared.persistSchemaFingerprint = async () => undefined;
    manager.tenantIsolation.applyTenantIsolation = async () => { order.push('isolation'); };
    await manager.syncCollection(collection);

    expect(order).toEqual(['index', 'index', 'isolation']);
  });
});
