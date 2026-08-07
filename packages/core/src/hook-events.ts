import { CollectionHookPhase } from '@core/enums/collection-hook-phase.enum';
import type { ICollectionHookEvents } from '@core/interfaces/collection-hook-events.interface';

/**
 * Collection hook event name utilities.
 *
 * @example
 * HookEventUtils.event('products', 'beforeCreate')  // "collection:products:beforeCreate"
 * HookEventUtils.events('products')                  // { beforeCreate: ..., afterCreate: ..., ... }
 * HookEventUtils.beforeCreate('products')            // "collection:products:beforeCreate"
 */
export class HookEventUtils {
  /** Public constant surface — each entry is the matching `CollectionHookPhase` member. */
  static readonly COLLECTION_HOOK_PHASES = {
    BEFORE_CREATE: CollectionHookPhase.BEFORE_CREATE,
    AFTER_CREATE: CollectionHookPhase.AFTER_CREATE,
    BEFORE_UPDATE: CollectionHookPhase.BEFORE_UPDATE,
    AFTER_UPDATE: CollectionHookPhase.AFTER_UPDATE,
    BEFORE_SAVE: CollectionHookPhase.BEFORE_SAVE,
    AFTER_SAVE: CollectionHookPhase.AFTER_SAVE,
    BEFORE_DELETE: CollectionHookPhase.BEFORE_DELETE,
    AFTER_DELETE: CollectionHookPhase.AFTER_DELETE,
  } as const;

  static readonly HOOK_EVENTS = {
    FRONTEND_HEAD: 'frontend:head',
  } as const;

  private static readonly EVENT_PREFIX = 'collection';
  private static readonly EVENT_DELIMITER = ':';
  private static readonly EVENT_WILDCARD = '*';

  private static normalize(value: string, fallback: string): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }

  static event(slug: string, action: CollectionHookPhase | string): string {
    return `${HookEventUtils.EVENT_PREFIX}${HookEventUtils.EVENT_DELIMITER}${HookEventUtils.normalize(slug, HookEventUtils.EVENT_WILDCARD)}${HookEventUtils.EVENT_DELIMITER}${CollectionHookPhase.resolve(action).value}`;
  }

  /**
   * THE canonical identity of a collection in a hook event name — the slug the plugin DECLARED.
   *
   * A registered collection carries four names: `slug` (overwritten at registration with the PHYSICAL
   * table name, `fcp_ecommerce_orders`), `shortSlug` (`orders`, and freely overridable — `products`
   * registers as `catalog`), `pluginSlug`, and `unprefixedSlug` (the name the plugin wrote in its own
   * schema, `ecommerce-orders`).
   *
   * The emitter used `slug`, so every event went out under the physical table name while plugins
   * subscribed under the declared one. Nothing matched and nothing said so: saving an order through the
   * admin minted no licence and wrote no finance transaction, and the save still reported success.
   *
   * The declared slug wins because it is the only one that is part of the plugin's public contract —
   * `slug` is a storage detail, and `shortSlug` is not unique across plugins. Core collections
   * (`users`, `media`, `settings`) have no `unprefixedSlug`; there all names coincide, so `slug` is the
   * correct fallback rather than a second rule.
   *
   * Resolve identity HERE and nowhere else. Emitting under two names instead would double-fire every
   * handler that already subscribes correctly.
   */
  static collectionIdentity(collection: { slug?: string; unprefixedSlug?: string }): string {
    return HookEventUtils.normalize(
      String(collection?.unprefixedSlug || ''),
      HookEventUtils.normalize(String(collection?.slug || ''), HookEventUtils.EVENT_WILDCARD)
    );
  }

  /**
   * A collection LIFECYCLE hook name (`beforeSave`, `afterDelete`, …) built from the collection itself.
   * The action is resolved through `CollectionHookPhase`, so only real phases may be passed.
   */
  static collectionEvent(
    collection: { slug?: string; unprefixedSlug?: string },
    action: CollectionHookPhase
  ): string {
    return HookEventUtils.event(HookEventUtils.collectionIdentity(collection), action);
  }

  /**
   * A collection NOTIFICATION name (`created`, `updated`, `saved`, `deleted`) built from the collection
   * itself.
   *
   * Deliberately separate from {@link collectionEvent}: these past-tense actions are NOT
   * `CollectionHookPhase` members, and `CollectionHookPhase.resolve` silently falls back to
   * `beforeCreate` for anything it does not recognise. Routing them through the phase path would
   * collapse `created`/`updated`/`saved`/`deleted` into one event and break every subscriber at once.
   */
  static collectionNotification(
    collection: { slug?: string; unprefixedSlug?: string },
    action: string
  ): string {
    return `${HookEventUtils.EVENT_PREFIX}${HookEventUtils.EVENT_DELIMITER}${HookEventUtils.collectionIdentity(collection)}${HookEventUtils.EVENT_DELIMITER}${String(action || '').trim()}`;
  }

  static events(slug: string): ICollectionHookEvents {
    return {
      beforeCreate: HookEventUtils.beforeCreate(slug),
      afterCreate: HookEventUtils.afterCreate(slug),
      beforeUpdate: HookEventUtils.beforeUpdate(slug),
      afterUpdate: HookEventUtils.afterUpdate(slug),
      beforeSave: HookEventUtils.beforeSave(slug),
      afterSave: HookEventUtils.afterSave(slug),
      beforeDelete: HookEventUtils.beforeDelete(slug),
      afterDelete: HookEventUtils.afterDelete(slug),
    };
  }

  static beforeCreate(slug: string): string { return HookEventUtils.event(slug, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_CREATE); }
  static afterCreate(slug: string): string { return HookEventUtils.event(slug, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_CREATE); }
  static beforeUpdate(slug: string): string { return HookEventUtils.event(slug, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_UPDATE); }
  static afterUpdate(slug: string): string { return HookEventUtils.event(slug, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_UPDATE); }
  static beforeSave(slug: string): string { return HookEventUtils.event(slug, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_SAVE); }
  static afterSave(slug: string): string { return HookEventUtils.event(slug, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_SAVE); }
  static beforeDelete(slug: string): string { return HookEventUtils.event(slug, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_DELETE); }
  static afterDelete(slug: string): string { return HookEventUtils.event(slug, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_DELETE); }
}
