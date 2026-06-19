import { AdminCollectionUtils } from '@/lib/collection-utils';
import { AdminUrlUtils } from '@/lib/url-utils';
import type { PermalinkInputProps, PermalinkComputed } from './permalink-input.interfaces';

/**
 * Derives the permalink preview parts (base URL, prefix, display slug, suffix, custom/absolute
 * mode) from the record value + collection + global settings for {@link PermalinkInput}.
 * Extracted from the component so its file stays under the size limit; logic is unchanged.
 */
export class PermalinkInputUtils {
  static compute(props: PermalinkInputProps, settings: Record<string, unknown> | null | undefined): PermalinkComputed {
    const { value, id, slug, collection, pluginSettings } = props;

    const baseUrl = AdminUrlUtils.resolveFrontendBaseUrl(settings);
    const structure = (settings as Record<string, any> | null)?.permalink_structure || '/:slug';
    const normalizedValue = String(value || '');
    const isAbsoluteOverride = normalizedValue.startsWith('/');

    const collectionPrefix = collection ? AdminCollectionUtils.getCollectionPrefix(collection, pluginSettings) : '';

    const isNumericOnly = structure.includes(':id') && !structure.includes(':slug');
    const isCustomMode = !!normalizedValue;
    const displayValue = (isCustomMode ? normalizedValue.replace(/^\/+/, '') : '') || (isNumericOnly ? (id || '') : (slug || 'unnamed-resource'));

    const now = new Date();
    const replacements: Record<string, string> = {
      ':year': now.getFullYear().toString(),
      ':month': (now.getMonth() + 1).toString().padStart(2, '0'),
      ':day': now.getDate().toString().padStart(2, '0'),
      ':hour': now.getHours().toString().padStart(2, '0'),
      ':minute': now.getMinutes().toString().padStart(2, '0'),
      ':second': now.getSeconds().toString().padStart(2, '0'),
      ':id': id || '...',
      ':slug': '{SLUG}',
    };

    let formattedStructure = structure;
    Object.entries(replacements).forEach(([key, val]) => {
      if (isNumericOnly && key === ':id' && !isCustomMode) return;
      formattedStructure = formattedStructure.replace(key, val);
    });

    let prefix = '/';
    let suffix = '';

    if (isNumericOnly && !isCustomMode) {
      const parts = formattedStructure.split(':id');
      prefix = (parts[0] || '/');
      suffix = parts[1] || '';
    } else if (!isCustomMode) {
      const parts = formattedStructure.split('{SLUG}');
      prefix = (parts[0] || '/');
      suffix = parts[1] || '';
    }

    let finalPrefix = prefix;
    if (!isAbsoluteOverride && collectionPrefix) {
      finalPrefix = `/${collectionPrefix}${prefix}`.replace(/\/+/g, '/');
    }

    const fullDisplayPrefix = `${baseUrl}${finalPrefix}`;

    return { baseUrl, finalPrefix, fullDisplayPrefix, displayValue, suffix, isCustomMode, isAbsoluteOverride };
  }
}
