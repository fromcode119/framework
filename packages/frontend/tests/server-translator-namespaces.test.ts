import { describe, expect, it } from 'vitest';
import { ServerTranslator } from '@/lib/ssr/server-translator';
import { ThemeSsrMarkup } from '@/lib/ssr/theme-ssr-markup';

/**
 * The document inlines only the translation namespaces its server render read. Every active
 * plugin's dictionary used to ride in the HTML — ~480 KB on a shop site, more than the page itself —
 * while the hydrating render needs only what the server painted. A namespace missed here would paint
 * a raw key at hydration, so both read paths (`t` and the `translations` object) must be recorded.
 */
describe('ServerTranslator namespaces', () => {
  const server = { shop: { cart: 'Количка' }, blog: { title: 'Блог' }, unused: { x: 'y' } };

  it('records namespaces looked up through t', () => {
    const translator = new ServerTranslator(server, {}, 'bg');
    expect(translator.translate('shop.cart')).toBe('Количка');
    translator.translate('missing.key');
    expect(translator.namespaces).toEqual(['missing', 'shop']);
  });

  it('records namespaces read straight off the translations object', () => {
    const translator = new ServerTranslator(server, {}, 'bg');
    expect((translator.effective.blog as Record<string, string>).title).toBe('Блог');
    expect(translator.namespaces).toEqual(['blog']);
  });

  it('carries the namespaces across the render-host wire', () => {
    const markup = ThemeSsrMarkup.from('<div>x</div>', false, ['shop'], ['blog', 'shop']);
    expect(ThemeSsrMarkup.fromParts(markup.toParts()).translationNamespaces).toEqual(['blog', 'shop']);
  });
});
