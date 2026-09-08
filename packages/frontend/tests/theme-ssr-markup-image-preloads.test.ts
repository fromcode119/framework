import { describe, expect, it } from 'vitest';
import { ThemeSsrMarkup } from '@/lib/ssr/theme-ssr-markup';

describe('ThemeSsrMarkup image preloads', () => {
  it('decodes the attribute-escaped href so the head does not re-escape an optimizer URL into a third URL', () => {
    const html = '<link rel="preload" as="image" href="/api/v1/plugins/zeta/img?src=%2Fx.jpg&amp;w=1400&amp;q=80"/><main>body</main>';
    const markup = ThemeSsrMarkup.from(html);
    expect(markup.imagePreloads).toEqual(['/api/v1/plugins/zeta/img?src=%2Fx.jpg&w=1400&q=80']);
    expect(markup.bodyHtml).toBe('<main>body</main>');
  });

  it('emits one preload per distinct href even when two blocks preload the same image', () => {
    const html = '<link rel="preload" as="image" href="/a.webp"/><link rel="preload" as="image" href="/a.webp"/><link rel="preload" as="image" href="/b.webp"/>';
    expect(ThemeSsrMarkup.from(html).imagePreloads).toEqual(['/a.webp', '/b.webp']);
  });

  it('keeps a plain href unchanged', () => {
    expect(ThemeSsrMarkup.from('<link rel="preload" as="image" href="/hero.webp"/>').imagePreloads).toEqual(['/hero.webp']);
  });
});
