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
export { CollectionIdentityService } from './collection-identity-service';
export { MediaRelationService } from './media-relation-service';
export * from './default-page-contract';
export { SeedPageService } from './seed-page-service';

// Main singleton
export { CoreServices } from './core-services';
