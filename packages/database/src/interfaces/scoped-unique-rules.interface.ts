import type { ITenantBlindUniqueRule } from '@database/interfaces/tenant-blind-unique-rule.interface';

/** What `scopeUniqueRules` rewrote, so the caller can say so without reading the catalog itself. */
export interface IScopedUniqueRules {
  constraints: ITenantBlindUniqueRule[];
  indexes: ITenantBlindUniqueRule[];
}
