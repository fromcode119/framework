import type { CollectionHookPhase, CollectionHookEvents } from './hook-events.types';

/**
 * Collection hook event name utilities.
 *
 * @example
 * HookEventUtils.event('products', 'beforeCreate')  // "collection:products:beforeCreate"
 * HookEventUtils.events('products')                  // { beforeCreate: ..., afterCreate: ..., ... }
 * HookEventUtils.beforeCreate('products')            // "collection:products:beforeCreate"
 */
export class HookEventUtils {
  static readonly COLLECTION_HOOK_PHASES = {
    BEFORE_CREATE: 'beforeCreate',
    AFTER_CREATE: 'afterCreate',
    BEFORE_UPDATE: 'beforeUpdate',
    AFTER_UPDATE: 'afterUpdate',
    BEFORE_SAVE: 'beforeSave',
    AFTER_SAVE: 'afterSave',
    BEFORE_DELETE: 'beforeDelete',
    AFTER_DELETE: 'afterDelete',
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

  static event(slug: string, action: CollectionHookPhase): string {
    return `${HookEventUtils.EVENT_PREFIX}${HookEventUtils.EVENT_DELIMITER}${HookEventUtils.normalize(slug, HookEventUtils.EVENT_WILDCARD)}${HookEventUtils.EVENT_DELIMITER}${action}`;
  }

  static events(slug: string): CollectionHookEvents {
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
