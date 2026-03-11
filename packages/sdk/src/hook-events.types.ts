// ─── Companion types file for hook-events.ts ────────────────────────────────

export type CollectionHookPhase =
  'beforeCreate' | 'afterCreate' | 'beforeUpdate' | 'afterUpdate' |
  'beforeSave' | 'afterSave' | 'beforeDelete' | 'afterDelete';

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
