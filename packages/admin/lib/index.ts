/**
 * @fromcode119/admin library utilities
 * 
 * This file exports server-side utilities and services.
 * For UI components, import from '@fromcode119/admin/components'
 */

// Services (singleton pattern for utilities)
export * from '@/lib/services';

// Utilities
export * from '@/lib/admin-path';
export * from '@/lib/api';
export * from '@/lib/auth-utils';
export * from '@/lib/collection-utils';
export * from '@/lib/constants/admin.constants';
export * from '@/lib/nav-utils';
export * from '@/lib/settings';
export * from '@/lib/theme-preview-utils';
export * from '@/lib/timezone';
export * from '@/lib/url-utils';
export * from '@/lib/admin-extensions';
export * from '@/lib/admin-proxy';

/**
 * The appearance engine + shared admin components.
 *
 * At runtime `@fromcode119/admin`, `@fromcode119/admin/components` and `@fromcode119/admin/services` are
 * ONE module (see ClientLayoutRuntimeService.buildAdminRuntimeModule), so an appearance bundle importing
 * `AdminComponent` from the bare specifier resolves fine. The types said otherwise, which made every such
 * import an error — this re-export makes the declared surface match what is actually served.
 */
export * from '@/components';
