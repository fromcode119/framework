import { describe, it, expect, afterEach } from 'vitest';
import { SsrContentShellService } from '../lib/ssr-shell/ssr-content-shell-service';
import { SsrShellThemeTemplateLoader } from '../lib/ssr-shell/ssr-shell-theme-template-loader';
import type { SsrShellSources } from '../lib/ssr-shell/ssr-content-shell.types';
import type { SsrShellThemeConfig } from '../lib/ssr-shell/ssr-shell-theme-template.types';

/**
 * The framework names no content fields — every value below is located by the paths a
 * THEME declares. These fixtures mirror the live vselenskiportal88 declaration, so the
 * suite doubles as the regression proof that the declared contract reproduces what the
 * deleted "first meaningful block" heuristic used to find.
 */
const themeConfig = (raw: Record<string, unknown>): SsrShellThemeConfig =>
  SsrShellThemeTemplateLoader.readConfig({
    ui: { ssrShell: { templates: [{ template: 'shell.html' }], ...raw } },
  }) as SsrShellThemeConfig;

const DOC_TOKENS = [
  {
    name: 'heading',
    from: 'doc',
    path: ['content.*', 'title'],
    pick: ['heading', 'data.heading', 'data.title', 'title', 'slides.0.heading'],
  },
  {
    name: 'text',
    from: 'doc',
    path: 'content.*',
    pick: ['description', 'data.description', 'data.text', 'text', 'slides.0.description'],
  },
];

const IMAGE_TOKEN = {
  name: 'imageUrl',
  from: 'doc',
  path: 'content.*',
  pick: ['slides.0.imageUrl', 'imageUrl', 'data.imageUrl', 'data.logo'],
  url: 'asset',
  preload: true,
};

const sources = (doc: unknown, extra: Partial<SsrShellSources> = {}): SsrShellSources => ({
  doc,
  site: null,
  prefetch: {},
  ...extra,
});

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

describe('SsrContentShellService.build — declared doc tokens', () => {
  const config = themeConfig({ tokens: DOC_TOKENS });

  it('resolves top-level block keys via the wildcard (about-page shape)', () => {
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
    const model = SsrContentShellService.build(sources(doc), config);
    expect(model.tokens.heading).toBe('Вселенски Портал');
    expect(model.tokens.text).toBe('Място, където енергията среща осъзнатостта.');
    expect(SsrContentShellService.readTitle(doc)).toBe('За нас');
    expect(SsrContentShellService.hasRenderableShell(model)).toBe(true);
  });

  it('unwraps a locale-keyed content map and reads data.* keys (home hero shape)', () => {
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
    const model = SsrContentShellService.build(sources(doc), config, { locale: 'en' });
    expect(model.tokens.heading).toBe('ВСЕЛЕНСКИ ПОРТАЛ');
    expect(model.tokens.text).toBe('Сияйна врата към мистериите.');
    expect(SsrContentShellService.readTitle(doc, 'en')).toBe('Начало');
  });

  it('falls back to the first available locale when the requested one is absent', () => {
    const doc = {
      title: { bg: 'Заглавие' },
      content: { bg: [{ type: 'content', data: { title: 'Х', text: 'Текст' } }] },
    };
    const model = SsrContentShellService.build(sources(doc), config, { locale: 'en' });
    expect(model.tokens.heading).toBe('Х');
    expect(model.tokens.text).toBe('Текст');
    expect(SsrContentShellService.readTitle(doc, 'en')).toBe('Заглавие');
  });

  it('reads a slider first slide (vision-board shape)', () => {
    const doc = {
      content: [
        {
          id: 'vb-hero',
          type: 'heroSlider',
          slides: [{ heading: 'Табло на мечтите', description: 'Пътеводител към твоите мечти' }],
        },
      ],
    };
    const model = SsrContentShellService.build(sources(doc), config);
    expect(model.tokens.heading).toBe('Табло на мечтите');
    expect(model.tokens.text).toBe('Пътеводител към твоите мечти');
  });

  it('binds picks to ONE element: a later block never out-ranks an earlier match', () => {
    // Element-outer ordering. `data.heading` precedes `data.title` in the pick list, but
    // block 0 resolves via `data.title`, so block 1's `data.heading` must NOT win.
    const doc = {
      content: [
        { type: 'hero', data: { title: 'ВСЕЛЕНСКИ ПОРТАЛ' } },
        { type: 'mission', data: { heading: 'Нашата мисия' } },
      ],
    };
    expect(SsrContentShellService.build(sources(doc), config).tokens.heading).toBe('ВСЕЛЕНСКИ ПОРТАЛ');
  });

  it('skips elements where no pick resolves', () => {
    const doc = { content: [{ type: 'spacer' }, { type: 'content', data: { text: 'Първи смислен текст' } }] };
    const model = SsrContentShellService.build(sources(doc), config);
    expect(model.tokens.heading).toBe('');
    expect(model.tokens.text).toBe('Първи смислен текст');
  });

  it('falls back to a later candidate path when the wildcard path resolves nothing', () => {
    const doc = { title: 'Page', content: '<p>html</p>' };
    const model = SsrContentShellService.build(sources(doc), config);
    expect(model.tokens.heading).toBe('Page');
    expect(model.tokens.text).toBe('');
  });

  it('is empty-safe for an absent doc and for a missing config', () => {
    expect(SsrContentShellService.build(sources(null), config).tokens.heading).toBe('');
    expect(SsrContentShellService.hasRenderableShell(SsrContentShellService.build(sources(null), config))).toBe(false);
    const bare = SsrContentShellService.build(sources({ title: 'X' }), null);
    expect(bare).toEqual({ tokens: {}, lists: {}, preloadImageUrl: '' });
    expect(SsrContentShellService.hasRenderableShell(bare)).toBe(false);
  });
});

describe('SsrContentShellService.build — preload-flagged image token', () => {
  const config = themeConfig({ tokens: [IMAGE_TOKEN] });

  it('exposes the flagged token as the preload image', () => {
    const doc = {
      content: [{ slides: [{ imageUrl: 'https://api.example.com/api/v1/themes/t/ui/images/top.jpg' }] }],
    };
    const model = SsrContentShellService.build(sources(doc), config);
    expect(model.preloadImageUrl).toBe('https://api.example.com/api/v1/themes/t/ui/images/top.jpg');
    expect(model.tokens.imageUrl).toBe(model.preloadImageUrl);
    expect(SsrContentShellService.hasRenderableShell(model)).toBe(true);
  });

  it('absolutizes root-relative asset paths and rejects unsafe schemes', () => {
    const ok = SsrContentShellService.build(sources({ content: [{ data: { imageUrl: '/uploads/x.webp' } }] }), config, {
      assetBaseUrl: 'https://api.example.com/',
    });
    expect(ok.preloadImageUrl).toBe('https://api.example.com/uploads/x.webp');

    const bad = SsrContentShellService.build(
      sources({ content: [{ data: { imageUrl: 'javascript:alert(1)' } }] }),
      config,
      { assetBaseUrl: 'https://api.example.com' },
    );
    expect(bad.preloadImageUrl).toBe('');
    expect(bad.tokens.imageUrl).toBe('');
  });

  it('reads locale-keyed image maps', () => {
    const doc = { content: [{ data: { logo: { bg: 'https://cdn.example.com/logo.webp' } } }] };
    expect(SsrContentShellService.build(sources(doc), config, { locale: 'bg' }).preloadImageUrl)
      .toBe('https://cdn.example.com/logo.webp');
  });

  it('resolves bare theme-asset paths to the theme ui asset URL', () => {
    const doc = { content: [{ slides: [{ imageUrl: 'images/vision-board/top-sm.jpg' }] }] };
    const model = SsrContentShellService.build(sources(doc), config, {
      assetBaseUrl: 'https://api.example.com',
      themeSlug: 'vselenskiportal88',
    });
    expect(model.preloadImageUrl).toContain('/themes/vselenskiportal88/ui/images/vision-board/top-sm.jpg');
    expect(model.preloadImageUrl.startsWith('https://api.example.com/')).toBe(true);
  });

  it('rejects traversal and bare paths without a theme slug', () => {
    const traversal = SsrContentShellService.build(
      sources({ content: [{ data: { imageUrl: 'images/../../etc/passwd' } }] }),
      config,
      { assetBaseUrl: 'https://x', themeSlug: 't' },
    );
    expect(traversal.preloadImageUrl).toBe('');
    const noTheme = SsrContentShellService.build(
      sources({ content: [{ data: { imageUrl: 'images/a.jpg' } }] }),
      config,
      { assetBaseUrl: 'https://x' },
    );
    expect(noTheme.preloadImageUrl).toBe('');
  });

  it('honours only the FIRST preload flag', () => {
    const twoFlags = themeConfig({
      tokens: [IMAGE_TOKEN, { ...IMAGE_TOKEN, name: 'second' }],
    });
    expect(twoFlags.tokens.filter((entry) => entry.preload)).toHaveLength(1);
  });

  it('returns no preload image when nothing resolves', () => {
    expect(SsrContentShellService.build(sources({ content: [{ heading: 'Text only' }] }), config).preloadImageUrl)
      .toBe('');
  });
});

describe('SsrContentShellService.build — site + prefetch sources and pageMatchPath', () => {
  const config = themeConfig({
    tokens: [
      { name: 'siteName', from: 'site', path: ['siteName', 'title'] },
      { name: 'price', from: 'prefetch', key: 'page-products', path: '0.effectivePrice', pageMatchPath: '0.slug' },
    ],
  });

  it('reads site settings via declared candidate paths', () => {
    const model = SsrContentShellService.build(sources(null, { site: { title: 'Fallback Name' } }), config);
    expect(model.tokens.siteName).toBe('Fallback Name');
  });

  it('resolves a prefetch scalar when the payload slug matches the page', () => {
    const model = SsrContentShellService.build(
      sources({ slug: 'numerology/consultation' }, {
        prefetch: { 'page-products': [{ slug: 'consultation', effectivePrice: 120 }] },
      }),
      config,
    );
    expect(model.tokens.price).toBe('120');
  });

  it('gates the token when the payload belongs to another page', () => {
    const model = SsrContentShellService.build(
      sources({ slug: 'home' }, { prefetch: { 'page-products': [{ slug: 'consultation', effectivePrice: 120 }] } }),
      config,
    );
    expect(model.tokens.price).toBe('');
  });

  it('gates the token when the page has no slug at all', () => {
    const model = SsrContentShellService.build(
      sources({}, { prefetch: { 'page-products': [{ slug: 'consultation', effectivePrice: 120 }] } }),
      config,
    );
    expect(model.tokens.price).toBe('');
  });
});

describe('SsrContentShellService.build — declared lists', () => {
  const config = themeConfig({
    lists: [
      {
        name: 'navItems',
        from: 'prefetch',
        key: 'navigation-main-menu',
        path: ['items'],
        fields: { label: { path: ['label', 'title'] }, href: { path: ['url', 'href'], url: 'link' } },
      },
    ],
  });

  const build = (payload: unknown) =>
    SsrContentShellService.build(sources(null, { prefetch: { 'navigation-main-menu': payload } }), config);

  it('maps declared fields over the declared array path', () => {
    const model = build({
      items: [
        { label: 'Начало', url: '/' },
        { label: 'Магазин', href: '/shop' },
        { label: 'Външен', url: 'https://example.org/a' },
      ],
    });
    expect(model.lists.navItems).toEqual([
      { label: 'Начало', href: '/' },
      { label: 'Магазин', href: '/shop' },
      { label: 'Външен', href: 'https://example.org/a' },
    ]);
    expect(SsrContentShellService.hasRenderableShell(model)).toBe(true);
  });

  it('drops items with an unsafe href or a missing declared field', () => {
    const model = build({
      items: [
        { label: 'Bad', url: 'javascript:alert(1)' },
        { label: 'Rel', url: 'sneaky/path' },
        { label: '', url: '/x' },
        { url: '/no-label' },
        'not-an-object',
        { label: 'Ok', url: '/ok' },
      ],
    });
    expect(model.lists.navItems).toEqual([{ label: 'Ok', href: '/ok' }]);
  });

  it('tolerates malformed and absent payloads', () => {
    expect(build(42).lists.navItems).toEqual([]);
    expect(build(undefined).lists.navItems).toEqual([]);
    expect(SsrContentShellService.build(sources(null), config).lists.navItems).toEqual([]);
  });

  it('never absolutizes a link field against the asset base', () => {
    const model = SsrContentShellService.build(
      sources(null, { prefetch: { 'navigation-main-menu': { items: [{ label: 'A', url: '/a' }] } } }),
      config,
      { assetBaseUrl: 'https://api.example.com', themeSlug: 't' },
    );
    expect(model.lists.navItems).toEqual([{ label: 'A', href: '/a' }]);
  });
});

describe('SsrShellThemeTemplateLoader.readConfig — unparseable configs fall back', () => {
  it('returns null without any usable template rule', () => {
    expect(SsrShellThemeTemplateLoader.readConfig(null)).toBeNull();
    expect(SsrShellThemeTemplateLoader.readConfig({ ui: {} })).toBeNull();
    expect(SsrShellThemeTemplateLoader.readConfig({ ui: { ssrShell: 'nope' } })).toBeNull();
    expect(SsrShellThemeTemplateLoader.readConfig({ ui: { ssrShell: { templates: [] } } })).toBeNull();
    // Unsafe template paths are dropped, which leaves no rule at all.
    expect(SsrShellThemeTemplateLoader.readConfig({
      ui: { ssrShell: { templates: [{ template: '../../etc/passwd' }] } },
    })).toBeNull();
    // No back-compat: the retired single-`template` string form is not a rule list.
    expect(SsrShellThemeTemplateLoader.readConfig({ ui: { ssrShell: { template: 'shell.html' } } })).toBeNull();
  });

  it('drops unrecognised tokens/lists but keeps the valid ones', () => {
    const config = themeConfig({
      tokens: [
        { name: 'good', from: 'doc', path: 'title' },
        { name: 'no-source', path: 'title' },
        { name: 'bad source', from: 'doc', path: 'title' },
        { name: 'unknownSource', from: 'plugin', path: 'title' },
        { name: 'prefetchNoKey', from: 'prefetch', path: 'x' },
        { name: 'noPath', from: 'doc' },
        'garbage',
      ],
      lists: [
        { name: 'ok', from: 'doc', path: 'items', fields: { a: 'a' } },
        { name: 'noFields', from: 'doc', path: 'items' },
      ],
    });
    expect(config.tokens.map((entry) => entry.name)).toEqual(['good']);
    expect(config.lists.map((entry) => entry.name)).toEqual(['ok']);
    expect(config.lists[0].fields.a).toEqual({ paths: ['a'] });
  });
});
