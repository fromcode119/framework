// ─── Companion types file for hook-events.ts ────────────────────────────────

export { CollectionHookPhase } from '@core/enums/collection-hook-phase.enum';

export interface ICollectionHookEvents {
  beforeCreate: string;
  afterCreate: string;
  beforeUpdate: string;
  afterUpdate: string;
  beforeSave: string;
  afterSave: string;
  beforeDelete: string;
  afterDelete: string;
}
