export const COLLECTION_HOOK_PHASES = {
  BEFORE_CREATE: 'beforeCreate',
  AFTER_CREATE: 'afterCreate',
  BEFORE_UPDATE: 'beforeUpdate',
  AFTER_UPDATE: 'afterUpdate',
  BEFORE_SAVE: 'beforeSave',
  AFTER_SAVE: 'afterSave',
  BEFORE_DELETE: 'beforeDelete',
  AFTER_DELETE: 'afterDelete'
} as const;

export type CollectionHookPhase =
  (typeof COLLECTION_HOOK_PHASES)[keyof typeof COLLECTION_HOOK_PHASES];

export type CollectionHookEvents = {
  beforeCreate: string;
  afterCreate: string;
  beforeUpdate: string;
  afterUpdate: string;
  beforeSave: string;
  afterSave: string;
  beforeDelete: string;
  afterDelete: string;
};

export const HOOK_EVENTS = {
  FRONTEND_HEAD: 'frontend:head'
} as const;

function normalizeHookSegment(value: string, fallback: string): string {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

export function collectionHookEvent(
  collectionSlug: string,
  phase: CollectionHookPhase
): string {
  const slug = normalizeHookSegment(collectionSlug, '*');
  return `collection:${slug}:${phase}`;
}

export function collectionHookEvents(collectionSlug: string): CollectionHookEvents {
  return {
    beforeCreate: collectionBeforeCreateHook(collectionSlug),
    afterCreate: collectionAfterCreateHook(collectionSlug),
    beforeUpdate: collectionBeforeUpdateHook(collectionSlug),
    afterUpdate: collectionAfterUpdateHook(collectionSlug),
    beforeSave: collectionBeforeSaveHook(collectionSlug),
    afterSave: collectionAfterSaveHook(collectionSlug),
    beforeDelete: collectionBeforeDeleteHook(collectionSlug),
    afterDelete: collectionAfterDeleteHook(collectionSlug)
  };
}

export function collectionBeforeCreateHook(collectionSlug: string): string {
  return collectionHookEvent(collectionSlug, COLLECTION_HOOK_PHASES.BEFORE_CREATE);
}

export function collectionAfterCreateHook(collectionSlug: string): string {
  return collectionHookEvent(collectionSlug, COLLECTION_HOOK_PHASES.AFTER_CREATE);
}

export function collectionBeforeUpdateHook(collectionSlug: string): string {
  return collectionHookEvent(collectionSlug, COLLECTION_HOOK_PHASES.BEFORE_UPDATE);
}

export function collectionAfterUpdateHook(collectionSlug: string): string {
  return collectionHookEvent(collectionSlug, COLLECTION_HOOK_PHASES.AFTER_UPDATE);
}

export function collectionBeforeSaveHook(collectionSlug: string): string {
  return collectionHookEvent(collectionSlug, COLLECTION_HOOK_PHASES.BEFORE_SAVE);
}

export function collectionAfterSaveHook(collectionSlug: string): string {
  return collectionHookEvent(collectionSlug, COLLECTION_HOOK_PHASES.AFTER_SAVE);
}

export function collectionBeforeDeleteHook(collectionSlug: string): string {
  return collectionHookEvent(collectionSlug, COLLECTION_HOOK_PHASES.BEFORE_DELETE);
}

export function collectionAfterDeleteHook(collectionSlug: string): string {
  return collectionHookEvent(collectionSlug, COLLECTION_HOOK_PHASES.AFTER_DELETE);
}
