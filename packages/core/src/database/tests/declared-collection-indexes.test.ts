import { describe, expect, it, vi } from 'vitest';
import { DeclaredSchemaReconciler } from '@core/database/declared-schema-reconciler';
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
    const db: any = { createIndexIfMissing: vi.fn(async () => undefined) };
    const plan = new EntitySchemaPlanService().buildPlan(collection, true, []);
    await new DeclaredSchemaReconciler(db, logger()).ensureDeclaredIndexes(plan);

    expect(db.createIndexIfMissing).toHaveBeenCalledTimes(2);
    expect(db.createIndexIfMissing).toHaveBeenCalledWith(
      'fcp_lms_progress', 'fcp_lms_progress_user_id_lesson_id_idx', ['user_id', 'lesson_id'], { unique: true });
    expect(db.createIndexIfMissing).toHaveBeenCalledWith(
      'fcp_lms_progress', 'fcp_lms_progress_status', ['status'], { unique: false });
  });

  it('is idempotent: a second sync issues the same IF-MISSING calls and changes nothing', async () => {
    const created = new Set<string>();
    const db: any = { createIndexIfMissing: vi.fn(async (_t: string, name: string) => { created.add(name); }) };
    const plan = new EntitySchemaPlanService().buildPlan(collection, true, []);
    const reconciler = new DeclaredSchemaReconciler(db, logger());
    await reconciler.ensureDeclaredIndexes(plan);
    await reconciler.ensureDeclaredIndexes(plan);
    expect(created.size).toBe(2);
  });

  it('a failing unique (duplicate rows) warns and does not throw or stop the next index', async () => {
    const log = logger();
    const db: any = {
      createIndexIfMissing: vi.fn()
        .mockRejectedValueOnce(new Error('could not create unique index: duplicate key'))
        .mockResolvedValueOnce(undefined),
    };
    const plan = new EntitySchemaPlanService().buildPlan(collection, true, []);
    await expect(new DeclaredSchemaReconciler(db, log).ensureDeclaredIndexes(plan)).resolves.toBeUndefined();

    expect(db.createIndexIfMissing).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn.mock.calls[0][0]).toMatch(/UNIQUE index "fcp_lms_progress_user_id_lesson_id_idx".*duplicate key/);
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
