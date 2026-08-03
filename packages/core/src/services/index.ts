/**
 * Core Services Module.
 * 
 * Provides class-based utility services for common operations.
 * 
 * @module @fromcode119/core/services
 */

// Base class
export { BaseService } from '@core/services/base-service';

// Service classes
export { LocalizationService } from '@core/services/localization-service';
export { ContentService } from '@core/services/content-service';
export { MenuService } from '@core/services/menu-service';
export { CollectionService } from '@core/services/collection-service';
export { CollectionWriteCompatibilityService } from '@core/services/collection-write-compatibility-service';
export { CollectionIdentityService } from '@core/services/collection-identity-service';
export { EntityValueParserService } from '@core/services/entity-value-parser-service';
export { EntityObjectMapperService } from '@core/services/entity-object-mapper-service';
export { EntityEnumResolverService } from '@core/services/entity-enum-resolver-service';
export { MediaRelationService } from '@core/services/media-relation-service';
export * from '@core/services/default-page-contract';
export { SeedPageService } from '@core/services/seed-page-service';
export { ContentResolutionGateRegistryService } from '@core/services/content-resolution-gate-registry-service';
export type { IContentResolutionGate } from '@core/services/interfaces/content-resolution-gate.interface';
export type { IContentResolutionGateOptions } from '@core/services/interfaces/content-resolution-gate-options.interface';
export { ContentResolutionResult } from '@core/services/content-resolution-result';

export { RedirectResolverRegistryService } from '@core/services/redirect-resolver-registry-service';
export { RedirectResolution } from '@core/services/redirect-resolution';
export type { IRedirectResolver } from '@core/services/interfaces/redirect-resolver.interface';

export { PluginEntityRecordsRegistryService } from '@core/services/entity-records/plugin-entity-records-registry-service';
export { EntityRecordsResolutionService } from '@core/services/entity-records/entity-records-resolution-service';
export type { IEntityRecordRef } from '@core/services/entity-records/interfaces/entity-record-ref.interface';
export type { IEntityRecordItem } from '@core/services/entity-records/interfaces/entity-record-item.interface';
export type { IEntityRecordProviderRegistration } from '@core/services/entity-records/interfaces/entity-record-provider-registration.interface';
export type { IRegisteredEntityRecordProvider } from '@core/services/entity-records/interfaces/registered-entity-record-provider.interface';
export type { IEntityRecordGroup } from '@core/services/entity-records/interfaces/entity-record-group.interface';
export type { IEntityRecordProviderError } from '@core/services/entity-records/interfaces/entity-record-provider-error.interface';
export type { IEntityRecordsResult } from '@core/services/entity-records/interfaces/entity-records-result.interface';

// Main singleton
export { CoreServices } from '@core/services/core-services';
