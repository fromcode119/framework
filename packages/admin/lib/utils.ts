import { normalizeLocaleCode, isLocaleLikeKey, resolveLocalizedText } from '@fromcode119/core/utils';
import { slugify } from '@fromcode119/sdk';
import { formatSystemDateTime } from './timezone';
import { api } from './api';
import { AdminServices } from './AdminServices';

export { normalizeLocaleCode, isLocaleLikeKey, resolveLocalizedText, slugify };

export const LOCALE_KEY_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i;

/**
 * Admin utilities module.
 * 
 * All deprecated utility functions have been removed in v2.0.
 * Use AdminServices.getInstance() to access all utility methods.
 * 
 * @example
 * ```typescript
 * import { AdminServices } from '@fromcode119/admin';
 * 
 * const services = AdminServices.getInstance();
 * const size = services.formatter.formatSize(1024);
 * const date = services.formatter.formatDate(new Date());
 * ```
 */

export { formatSystemDateTime, api, AdminServices };
