/**
 * Class-based router infrastructure.
 * 
 * All API routers should extend BaseRouter for consistency.
 * 
 * @module @fromcode119/api/routers
 */

export { BaseRouter } from './base-router';

// Re-export all router classes
export { AuthRouter } from '../routes/auth-router';
export { CollectionRouter } from '../routes/collection-router';
export { BaseCollectionRouter } from '../routes/base-collection-router';
export { PluginRouter } from '../routes/plugin-router-class';
export { PluginAssetRouter } from '../routes/plugin-asset-router';
export { MediaRouter } from '../routes/media-router';
export { ThemeRouter } from '../routes/theme-router-class';
export { ThemeAssetRouter } from '../routes/theme-asset-router';
export { SystemRouter } from '../routes/system-router';
