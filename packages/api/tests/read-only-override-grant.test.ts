import { AuthManager } from '@fromcode119/auth';
import { CollectionFieldGuard } from '@api/controllers/collection-field-guard';
import { ReadOnlyOverrideGrantUtils } from '@api/utils/read-only-override-grant-utils';

/**
 * The server half of the read-only override: what the API will and will not accept as permission to
 * change a field the operator is not normally allowed to touch.
 *
 * Two things changed and both are load-bearing. The payload used to carry the operator's ACCOUNT
 * PASSWORD on every save; it now carries a short-lived grant scoped to one record. And the unlock is
 * now per RECORD rather than per field, so the per-field membership check is gone — which makes the
 * `readOnlyOverride: 'never'` case the thing that must not regress.
 */
describe('read-only override grant enforcement', () => {
  const SECRET = 'test-secret-123';
  const USER_ID = 7;
  const RECORD = { id: 1086, orderNumber: 'ORD-000566', statusHistory: 'pending' };

  const collection: any = {
    slug: 'orders',
    fields: [
      { name: 'statusHistory', label: 'Status History', admin: { readOnly: true } },
      { name: 'orderNumber', label: 'Order Number', admin: { readOnly: true, readOnlyOverride: 'never' } },
      { name: 'internalNote', label: 'Internal Note', admin: {} },
    ],
  };

  const auth = new AuthManager(SECRET);
  const db: any = { findOne: async () => ({ id: USER_ID }) };
  const guard = new CollectionFieldGuard(db, auth as any);
  const req = { user: { id: USER_ID } };

  const mint = (recordId: string | number | null = RECORD.id, slug = 'orders') =>
    auth.generateGrantToken({
      userId: USER_ID,
      purpose: ReadOnlyOverrideGrantUtils.PURPOSE,
      scope: ReadOnlyOverrideGrantUtils.scope(slug, recordId),
    });

  const enforce = (incomingData: Record<string, any>, grant: string, fields: string[] = Object.keys(incomingData)) =>
    guard.enforceReadOnlyFieldConstraints({
      collection,
      incomingData,
      existingRecord: RECORD,
      req,
      overrideMeta: { fields: new Set(fields), grant },
    });

  it('accepts a change to a read-only field when the grant is for this record', async () => {
    await expect(enforce({ statusHistory: 'shipped' }, await mint())).resolves.toBeUndefined();
  });

  it('REFUSES the change when no grant is presented', async () => {
    await expect(enforce({ statusHistory: 'shipped' }, '')).rejects.toThrow(/Unlock confirmation is required/i);
  });

  it('REFUSES a grant minted for a different record', async () => {
    await expect(enforce({ statusHistory: 'shipped' }, await mint(9999))).rejects.toThrow(/expired|unlock/i);
  });

  it('REFUSES a grant minted for a different collection', async () => {
    await expect(enforce({ statusHistory: 'shipped' }, await mint(RECORD.id, 'invoices'))).rejects.toThrow(/expired|unlock/i);
  });

  it('REFUSES an expired grant', async () => {
    const stale = await auth.generateGrantToken(
      { userId: USER_ID, purpose: ReadOnlyOverrideGrantUtils.PURPOSE, scope: ReadOnlyOverrideGrantUtils.scope('orders', RECORD.id) },
      { expiresIn: '-1s' },
    );
    await expect(enforce({ statusHistory: 'shipped' }, stale)).rejects.toThrow(/expired|unlock/i);
  });

  /**
   * The regression the record-wide unlock could have caused: one password entry must not reach a field
   * the collection declared un-overrideable.
   */
  it('REFUSES a `readOnlyOverride: never` field even with a valid grant', async () => {
    await expect(enforce({ orderNumber: 'ORD-999999' }, await mint())).rejects.toThrow(/cannot be modified/i);
  });

  it('unlocks a SECOND read-only field on the same record from the one grant', async () => {
    const twoFields: any = { ...collection, fields: [...collection.fields, { name: 'codAmount', label: 'COD amount', admin: { readOnly: true } }] };
    await expect(guard.enforceReadOnlyFieldConstraints({
      collection: twoFields,
      incomingData: { statusHistory: 'shipped', codAmount: 40 },
      existingRecord: { ...RECORD, codAmount: 32.4 },
      req,
      overrideMeta: { fields: new Set(['statusHistory', 'codAmount']), grant: await mint() },
    })).resolves.toBeUndefined();
  });

  it('needs no grant when nothing read-only actually changed', async () => {
    await expect(enforce({ statusHistory: 'pending', internalNote: 'call before delivery' }, '')).resolves.toBeUndefined();
  });

  it('strips the override envelope out of the data that gets written', () => {
    const { data, overrideMeta } = guard.extractReadOnlyOverrideMetadata({
      statusHistory: 'shipped',
      _readOnlyOverride: { fields: ['statusHistory'], grant: 'g' },
    });
    expect(data._readOnlyOverride).toBeUndefined();
    expect(data.statusHistory).toBe('shipped');
    expect(overrideMeta.grant).toBe('g');
  });

  /** Nothing in the accepted payload shape may carry a credential any more. */
  it('ignores a password if one is still sent', () => {
    const { overrideMeta } = guard.extractReadOnlyOverrideMetadata({
      _readOnlyOverride: { fields: ['statusHistory'], password: 'hunter2' },
    });
    expect(overrideMeta.grant).toBe('');
    expect((overrideMeta as any).password).toBeUndefined();
  });
});
