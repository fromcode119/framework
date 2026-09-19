import { describe, expect, it } from 'vitest';
import { TenantImportPlan } from '@core/tenant/provisioning/tenant-import-plan';

/**
 * The preview must be able to say "the credentials come across" as a FACT. Until the plan carried
 * this the screen could only phrase it as a warning about their loss — and told operators to retype
 * a courier login that would have worked.
 */
describe('TenantImportPlan.secretsSealed', () => {
  const plan = (sealed: boolean): TenantImportPlan => new TenantImportPlan(
    [],
    [],
    null,
    { total: 0, existing: 0, toCreate: 0 },
    { count: 0, bytes: 0, colliding: 0 },
    [],
    [],
    [],
    0,
    0,
    sealed,
  );

  it('crosses the wire, so the admin can state it', () => {
    expect(plan(true).secretsSealed).toBe(true);
    expect(plan(true).toJSON().secretsSealed).toBe(true);
  });

  it('is false when the archive was not sealed, so nothing claims secrets travel', () => {
    expect(plan(false).secretsSealed).toBe(false);
    expect(plan(false).toJSON().secretsSealed).toBe(false);
  });
});
