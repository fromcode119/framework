/**
 * Internal SDK exports — NOT part of the public plugin API.
 * Only framework-internal packages (core, api, scheduler) should import from here.
 * Plugins must never access these directly.
 */
export { SystemTable, SystemMetaKey, ApiPath, AppPath, StorageConfig, PublicRoutePrefixes } from './constants';
