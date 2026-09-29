import { describe, expect, it } from 'vitest';
import { CollectionListUtils } from '@/components/collection/list/utils';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A boolean column's badge is chosen by what the field IS, so translating its label must not change
 * which words the badge uses.
 */
describe('CollectionListUtils.resolveBooleanBadge', () => {
  it('reads the field name when the label is translated', () => {
    expect(CollectionListUtils.resolveBooleanBadge('active', 'Активен', true)?.label).toBe(AdminI18n.t('common.active'));
    expect(CollectionListUtils.resolveBooleanBadge('published', 'Публикувано', false)?.label).toBe(AdminI18n.t('common.draft'));
  });

  it('still reads an English label on a field named otherwise', () => {
    expect(CollectionListUtils.resolveBooleanBadge('isEnabled', 'Enabled', true)?.label).toBe(AdminI18n.t('common.enabled'));
  });

  it('falls back to yes/no for any other flag', () => {
    expect(CollectionListUtils.resolveBooleanBadge('featured', 'Препоръчан', true)?.label).toBe(AdminI18n.t('common.yes'));
  });
});
