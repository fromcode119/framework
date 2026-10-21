import { describe, expect, it } from 'vitest';
import { ServerTranslator } from '@/lib/ssr/server-translator';
import { ThemeSsrMarkup } from '@/lib/ssr/theme-ssr-markup';

/**
 * The document inlines only the translation keys its server render read. Every active plugin's
 * dictionary used to ride in the HTML — ~480 KB on a shop site, more than the page itself — while the
 * hydrating render needs only what the server painted. A key missed here would paint a raw key at
 * hydration, so every read path (`t`, a property read, an enumeration) must be recorded.
 */
describe('ServerTranslator paths', () => {
  const server = { shop: { cart: 'Количка', checkout: { title: 'Плащане', pay: 'Плати' } }, blog: { title: 'Блог' }, unused: { x: 'y' } };

  it('records keys looked up through t', () => {
    const translator = new ServerTranslator(server, {}, 'bg');
    expect(translator.translate('shop.cart')).toBe('Количка');
    translator.translate('missing.key');
    expect(translator.paths).toEqual(['missing.key', 'shop.cart']);
  });

  it('records keys read straight off the translations object', () => {
    const translator = new ServerTranslator(server, {}, 'bg');
    const shop = translator.effective.shop as Record<string, Record<string, string>>;
    expect(shop.checkout.title).toBe('Плащане');
    expect(translator.paths).toEqual(['shop.checkout.title']);
  });

  it('records a whole subtree the render enumerated', () => {
    const translator = new ServerTranslator(server, {}, 'bg');
    const shop = translator.effective.shop as Record<string, unknown>;
    expect(Object.keys(shop.checkout as object)).toEqual(['title', 'pay']);
    expect(translator.paths).toEqual(['shop.checkout']);
  });

  it('carries the paths across the render-host wire', () => {
    const markup = ThemeSsrMarkup.from('<div>x</div>', false, ['shop'], ['blog.title', 'shop.cart']);
    expect(ThemeSsrMarkup.fromParts(markup.toParts()).translationPaths).toEqual(['blog.title', 'shop.cart']);
  });
});
