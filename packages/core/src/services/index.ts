/**
 * Core Services Module.
 * 
 * Provides class-based utility services for common operations.
 * 
 * @module @fromcode119/core/services
 */

// Base class
export { BaseService } from './base-service';

// Service classes
export { LocalizationService } from './localization-service';
export { ContentService } from './content-service';
export { MenuService } from './menu-service';
export { CollectionService } from './collection-service';
export { CollectionWriteCompatibilityService } from './collection-write-compatibility-service';
export { CollectionIdentityService } from './collection-identity-service';
export { EntityValueParserService } from './entity-value-parser-service';
export { EntityObjectMapperService } from './entity-object-mapper-service';
export { EntityEnumResolverService } from './entity-enum-resolver-service';
export { MediaRelationService } from './media-relation-service';
export * from './default-page-contract';
export { SeedPageService } from './seed-page-service';
export { ContentResolutionGateRegistryService } from './content-resolution-gate-registry-service';
export type {
  ContentResolutionGate,
  ContentResolutionGateOptions,
  ContentResolutionResult,
} from './content-resolution-gate.types';

export { PluginEntityRecordsRegistryService } from './entity-records/plugin-entity-records-registry-service';
export { EntityRecordsResolutionService } from './entity-records/entity-records-resolution-service';
export type {
  EntityRecordRef,
  EntityRecordItem,
  EntityRecordProviderRegistration,
  RegisteredEntityRecordProvider,
  EntityRecordGroup,
  EntityRecordProviderError,
  EntityRecordsResult,
} from './entity-records/entity-record.interfaces';

// Main singleton
export { CoreServices } from './core-services';
