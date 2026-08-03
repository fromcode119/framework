/**
 * Plugin Registry Package
 * 
 * Provides a cohesive API for accessing plugin collections with automatic
 * field name normalization and table resolution.
 */

export type { ICollectionQueryBuilder } from '@plugins/interfaces/collection-query-builder.interface';
export type { IPluginProxy } from '@plugins/interfaces/plugin-proxy.interface';
export * from '@plugins/plugin-registry';

