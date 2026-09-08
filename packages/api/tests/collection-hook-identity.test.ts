import { describe, it, expect } from 'vitest';
import { HookEventUtils, HookManager, CollectionHookPhase } from '@fromcode119/core';
import type { ICollection } from '@fromcode119/core';
import { RestControllerRuntime } from '@api/controllers/rest/rest-controller-runtime';
import type { IDatabaseManager } from '@fromcode119/database';

/**
 * A plugin collection carries FOUR names. `slug` is overwritten at registration with the physical
 * table name; `unprefixedSlug` keeps the slug the plugin actually declared. The REST controller emitted
 * under `slug`, so `collection:fcp_beta_orders:afterSave` went out while beta listened on
 * `collection:beta-orders:afterSave`. Neither side matched, and the save still reported success —
 * an admin order save minted no licence key and wrote no gamma transaction, silently.
 */
const orders = (): ICollection =>
  ({
    slug: 'fcp_beta_orders',
    unprefixedSlug: 'beta-orders',
    shortSlug: 'orders',
    pluginSlug: 'beta',
    fields: [],
  } as unknown as ICollection);

/** A collection whose shortSlug deliberately differs from both other names (beta `products`). */
const products = (): ICollection =>
  ({
    slug: 'fcp_beta_products',
    unprefixedSlug: 'beta-products',
    shortSlug: 'catalog',
    pluginSlug: 'beta',
    fields: [],
  } as unknown as ICollection);

/** A core collection: no unprefixedSlug, all names coincide. */
const users = (): ICollection => ({ slug: 'users', fields: [] } as unknown as ICollection);

describe('HookEventUtils collection identity', () => {
  it('uses the DECLARED slug, not the physical table name', () => {
    expect(HookEventUtils.collectionIdentity(orders())).toBe('beta-orders');
    expect(HookEventUtils.collectionEvent(orders(), CollectionHookPhase.AFTER_SAVE)).toBe(
      'collection:beta-orders:afterSave'
    );
  });

  it('ignores shortSlug, which is overridable and not unique across plugins', () => {
    // `products` registers with shortSlug `catalog`; keying on it is the exact mistake that once
    // dropped collection extensions silently.
    expect(HookEventUtils.collectionIdentity(products())).toBe('beta-products');
  });

  it('falls back to slug for core collections, which have no declared slug', () => {
    expect(HookEventUtils.collectionEvent(users(), CollectionHookPhase.AFTER_SAVE)).toBe(
      'collection:users:afterSave'
    );
  });

  it('keeps notification actions verbatim — resolving them as phases would collapse them all', () => {
    // CollectionHookPhase.resolve falls back to beforeCreate for anything unrecognised, so these four
    // distinct notifications would have become one event.
    const events = ['created', 'updated', 'saved', 'deleted'].map((action) =>
      HookEventUtils.collectionNotification(orders(), action)
    );
    expect(events).toEqual([
      'collection:beta-orders:created',
      'collection:beta-orders:updated',
      'collection:beta-orders:saved',
      'collection:beta-orders:deleted',
    ]);
    expect(new Set(events).size).toBe(4);
  });
});

describe('RestControllerRuntime collection hooks', () => {
  const runtimeWith = (hooks: HookManager): RestControllerRuntime =>
    new RestControllerRuntime({} as IDatabaseManager, undefined, undefined, hooks);

  it('fires an afterSave listener registered with the LOGICAL collection name', async () => {
    const hooks = new HookManager();
    const seen: unknown[] = [];
    hooks.on('collection:beta-orders:afterSave', (payload: unknown) => {
      seen.push(payload);
      return payload;
    });

    const result = await runtimeWith(hooks).callCollectionHook(
      orders(),
      CollectionHookPhase.AFTER_SAVE,
      { id: 7 }
    );

    expect(seen).toEqual([{ id: 7 }]);
    expect(result).toEqual({ id: 7 });
  });

  it('does NOT fire a listener registered with the physical table name', async () => {
    const hooks = new HookManager();
    const seen: unknown[] = [];
    hooks.on('collection:fcp_beta_orders:afterSave', (payload: unknown) => {
      seen.push(payload);
      return payload;
    });

    await runtimeWith(hooks).callCollectionHook(orders(), CollectionHookPhase.AFTER_SAVE, { id: 7 });

    expect(seen).toEqual([]);
  });

  it('lets a beforeSave listener transform the payload the write will persist', async () => {
    const hooks = new HookManager();
    hooks.on('collection:beta-orders:beforeSave', (payload: Record<string, unknown>) => ({
      ...payload,
      licenceKey: 'LIC-1',
    }));

    const result = await runtimeWith(hooks).callCollectionHook(
      orders(),
      CollectionHookPhase.BEFORE_SAVE,
      { id: 7 }
    );

    expect(result).toEqual({ id: 7, licenceKey: 'LIC-1' });
  });

  it('surfaces a throwing hook handler instead of silently continuing the write', async () => {
    const hooks = new HookManager();
    hooks.on('collection:beta-orders:beforeSave', () => {
      throw new Error('licence quota exhausted');
    });

    await expect(
      runtimeWith(hooks).callCollectionHook(orders(), CollectionHookPhase.BEFORE_SAVE, { id: 7 })
    ).rejects.toThrow('licence quota exhausted');
  });

  it('emits the past-tense notification under the logical name too', () => {
    const hooks = new HookManager();
    const seen: string[] = [];
    hooks.on('collection:beta-orders:saved', (_payload: unknown, event: string) => {
      seen.push(event);
    });

    runtimeWith(hooks).emitCollectionEvent(orders(), 'saved', { id: 7 });

    expect(seen).toEqual(['collection:beta-orders:saved']);
  });
});
