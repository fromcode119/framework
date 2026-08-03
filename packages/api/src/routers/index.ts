/**
 * Class-based router infrastructure.
 * 
 * All API routers should extend BaseRouter for consistency.
 * 
 * @module @fromcode119/api/routers
 */

export { BaseRouter } from '@fromcode119/core';

// Re-export all router classes
export { AuthRouter } from '@api/routes/auth-router';
export { CollectionRouter } from '@api/routes/collection-router';
export { BaseCollectionRouter } from '@api/routes/base-collection-router';
export { PluginRouter } from '@api/routes/plugins/plugin-router';
export { PluginAssetRouter } from '@api/routes/plugins/plugin-asset-router';
export { MediaRouter } from '@api/routes/media-router';
export { ThemeRouter } from '@api/routes/themes/theme-router';
export { ThemeAssetRouter } from '@api/routes/themes/theme-asset-router';
export { SystemRouter } from '@api/routes/system-router';
