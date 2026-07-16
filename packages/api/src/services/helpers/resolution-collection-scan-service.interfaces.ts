import type { Collection } from '@fromcode119/core';

export interface ResolutionScanEntry {
  collection: Collection;
  pluginSlug: string;
}

export interface ResolutionScanOptions {
  user?: any;
  preview?: boolean;
  locale?: string;
  fallback_locale?: string;
  locale_mode?: string;
}

export interface ResolutionScanContext {
  entries: ResolutionScanEntry[];
  options: ResolutionScanOptions;
  withLocale: (q: any) => any;
}

export interface ResolutionPriorityScanContext extends ResolutionScanContext {
  /** Path-shaped candidates matched against `customPermalink`, in priority order. */
  pathCandidates: string[];
  /** Bare-slug candidates matched against `slug`, in priority order (after all path candidates). */
  slugCandidates: string[];
  presentCustom: (doc: any, collection: Collection) => any;
  presentSlug: (doc: any, collection: Collection, candidate: string) => any;
}

export interface ResolutionStructureScanContext extends ResolutionScanContext {
  pathSegments: string[];
  structureSegments: string[];
}

export interface ResolutionScanResult {
  type: string;
  plugin: string;
  doc: any;
}
