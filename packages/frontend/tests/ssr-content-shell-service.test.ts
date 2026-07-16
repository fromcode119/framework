import { describe, it, expect, afterEach } from 'vitest';
import { SsrContentShellService } from '../lib/ssr-shell/ssr-content-shell-service';
import type { ThemePrefetchApiEntry } from '../lib/theme/theme-data-prefetcher.interfaces';

describe('SsrContentShellService.isEnabled', () => {
  const original = process.env.SSR_CONTENT_SHELL;

  afterEach(() => {
    if (original === undefined) delete process.env.SSR_CONTENT_SHELL;
    else process.env.SSR_CONTENT_SHELL = original;
  });

  it('defaults ON when the env flag is absent', () => {
    delete process.env.SSR_CONTENT_SHELL;
    expect(SsrContentShellService.isEnabled()).toBe(true);
  });

  it('is disabled by false/0/off', () => {
    for (const value of ['false', '0', 'off', 'FALSE', ' Off ']) {
      process.env.SSR_CONTENT_SHELL = value;
      expect(SsrContentShellService.isEnabled()).toBe(false);
    }
  });

  it('stays enabled for any other value', () => {
    process.env.SSR_CONTENT_SHELL = 'true';
    expect(SsrContentShellService.isEnabled()).toBe(true);
  });
});

describe('SsrContentShellService.build', () => {
  it('extracts title, hero heading and description from a block-array doc (about-page shape)', () => {
    const doc = {
      title: 'За нас',
      content: [
        {
          id: 'about-hero',
          type: 'hero',
          badge: 'ЗА НАС',
          heading: 'Вселенски Портал',
          description: 'Място, където енергията среща осъзнатостта.',
          data: {},
        },
      ],
    };
    const model = SsrContentShellService.build(doc, { siteName: 'Site' });
    expect(model.title).toBe('За нас');
    expect(model.heading).toBe('Вселенски Портал');
    expect(model.text).toBe('Място, където енергията среща осъзнатостта.');
    expect(model.siteName).toBe('Site');
    expect(SsrContentShellService.hasRenderableShell(model)).toBe(true);
  });

  it('reads data.title/data.description blocks (home hero shape) and locale-keyed maps', () => {
    const doc = {
      title: { en: 'Начало' },
      content: {
        en: [
          {
            id: 'home-hero',
            type: 'hero',
            data: { title: 'ВСЕЛЕНСКИ ПОРТАЛ', description: 'Сияйна врата към мистериите.' },
          },
        ],
      },
    };
    const model = SsrContentShellService.build(doc, { locale: 'en' });
    expect(model.title).toBe('Начало');
    expect(model.heading).toBe('ВСЕЛЕНСКИ ПОРТАЛ');
    expect(model.text).toBe('Сияйна врата към мистериите.');
  });

  it('falls back to the first available locale when the requested locale is absent', () => {
    const doc = {
      title: { bg: 'Заглавие' },
      content: { bg: [{ type: 'content', data: { title: 'Х', text: 'Текст' } }] },
    };
    const model = SsrContentShellService.build(doc, { locale: 'en' });
    expect(model.title).toBe('Заглавие');
    expect(model.heading).toBe('Х');
    expect(model.text).toBe('Текст');
  });

  it('reads a heroSlider first slide (vision-board shape)', () => {
    const doc = {
      title: 'Табло на мечтите',
      content: [
        {
          id: 'vb-hero',
          type: 'heroSlider',
          slides: [{ heading: 'Табло на мечтите', description: 'Пътеводител към твоите мечти' }],
        },
      ],
    };
    const model = SsrContentShellService.build(doc, {});
    expect(model.heading).toBe('Табло на мечтите');
    expect(model.text).toBe('Пътеводител към твоите мечти');
  });

  it('skips heading-less leading blocks and stops after the candidate window', () => {
    const doc = {
      title: 'T',
      content: [
        { type: 'spacer' },
        { type: 'content', data: { text: 'Първи смислен текст' } },
      ],
    };
    const model = SsrContentShellService.build(doc, {});
    expect(model.heading).toBe('');
    expect(model.text).toBe('Първи смислен текст');
  });

  it('is empty-safe for absent/HTML-string content', () => {
    expect(SsrContentShellService.build(null, {}).title).toBe('');
    const model = SsrContentShellService.build({ title: 'Page', content: '<p>html</p>' }, {});
    expect(model.title).toBe('Page');
    expect(model.heading).toBe('');
    expect(model.text).toBe('');
    expect(SsrContentShellService.hasRenderableShell(model)).toBe(true);
    expect(SsrContentShellService.hasRenderableShell(SsrContentShellService.build(null, {}))).toBe(false);
  });
});

describe('SsrContentShellService.extractNavItems', () => {
  const apis: ThemePrefetchApiEntry[] = [
    { key: 'navigation-main-menu', pluginSlug: 'x', ssrShellNav: true },
    { key: 'navigation-footer-links', pluginSlug: 'x' },
  ];

  it('normalizes items only from ssrShellNav-flagged entries', () => {
    const prefetch = {
      'navigation-main-menu': {
        items: [
          { label: 'Начало', url: '/' },
          { label: 'Магазин', href: '/shop' },
          { label: 'Външен', url: 'https://example.org/a' },
        ],
      },
      'navigation-footer-links': { items: [{ label: 'Footer', url: '/footer' }] },
    };
    const items = SsrContentShellService.extractNavItems(prefetch, apis);
    expect(items).toEqual([
      { label: 'Начало', href: '/' },
      { label: 'Магазин', href: '/shop' },
      { label: 'Външен', href: 'https://example.org/a' },
    ]);
  });

  it('drops unsafe or incomplete items and tolerates malformed payloads', () => {
    const prefetch = {
      'navigation-main-menu': {
        items: [
          { label: 'Bad', url: 'javascript:alert(1)' },
          { label: '', url: '/x' },
          { url: '/no-label' },
          'not-an-object',
          { label: 'Ok', url: '/ok' },
        ],
      },
    };
    expect(SsrContentShellService.extractNavItems(prefetch, apis)).toEqual([{ label: 'Ok', href: '/ok' }]);
    expect(SsrContentShellService.extractNavItems({ 'navigation-main-menu': 42 }, apis)).toEqual([]);
    expect(SsrContentShellService.extractNavItems({}, apis)).toEqual([]);
  });

  it('accepts a bare-array payload', () => {
    const prefetch = { 'navigation-main-menu': [{ label: 'A', url: '/a' }] };
    expect(SsrContentShellService.extractNavItems(prefetch, apis)).toEqual([{ label: 'A', href: '/a' }]);
  });
});
