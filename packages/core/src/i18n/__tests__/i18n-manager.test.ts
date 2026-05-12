import { describe, expect, it } from 'vitest';
import { I18nManager } from '../i18n-manager';

const englishTranslations = {
  rowLabels: {
    orderLabel: 'Order',
  },
};

const bulgarianTranslations = {
  rowLabels: {
    orderLabel: 'Поръчка',
  },
};

describe('I18nManager', () => {
  it('returns translated value when the key exists', () => {
    const manager = new I18nManager('en');
    manager.registerTranslations('en', 'ecommerce', englishTranslations);

    expect(manager.translateOrFallback('ecommerce.rowLabels.orderLabel', 'Fallback', {}, 'en')).toBe('Order');
  });

  it('returns fallback when the key does not exist', () => {
    const manager = new I18nManager('en');
    manager.registerTranslations('en', 'ecommerce', englishTranslations);

    expect(manager.translateOrFallback('ecommerce.rowLabels.missingLabel', 'Fallback', {}, 'en')).toBe('Fallback');
  });

  it('respects the requested locale before falling back', () => {
    const manager = new I18nManager('en');
    manager.registerTranslations('en', 'ecommerce', englishTranslations);
    manager.registerTranslations('bg', 'ecommerce', bulgarianTranslations);

    expect(manager.translateOrFallback('ecommerce.rowLabels.orderLabel', 'Fallback', {}, 'bg')).toBe('Поръчка');
  });
});
