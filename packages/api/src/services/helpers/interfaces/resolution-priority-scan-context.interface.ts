import type { ICollection } from '@fromcode119/core';
import { IResolutionScanContext } from '@api/services/helpers/interfaces/resolution-scan-context.interface';

export interface IResolutionPriorityScanContext extends IResolutionScanContext {
  /** Path-shaped candidates matched against `customPermalink`, in priority order. */
  pathCandidates: string[];
  /** Bare-slug candidates matched against `slug`, in priority order (after all path candidates). */
  slugCandidates: string[];
  presentCustom: (doc: any, collection: ICollection) => any;
  presentSlug: (doc: any, collection: ICollection, candidate: string) => any;
}
