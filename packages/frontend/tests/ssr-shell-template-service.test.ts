import { describe, it, expect } from 'vitest';
import { SsrShellTemplateService } from '../lib/ssr-shell/ssr-shell-template-service';
import { SsrShellThemeTemplateLoader } from '../lib/ssr-shell/ssr-shell-theme-template-loader';
import type { SsrShellModel } from '../lib/ssr-shell/ssr-content-shell.types';
import type { SsrShellThemeConfig } from '../lib/ssr-shell/ssr-shell-theme-template.types';

describe('SsrShellTemplateService.render', () => {
  it('substitutes tokens with HTML-escaped values', () => {
    const out = SsrShellTemplateService.render('<h1>{{heading}}</h1>', {
      heading: '<script>alert("x")</script> & "quotes"',
    });
    expect(out).toBe('<h1>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;quotes&quot;</h1>');
  });

  it('renders unknown/missing tokens as empty strings', () => {
    expect(SsrShellTemplateService.render('a{{nope}}b', {})).toBe('ab');
    expect(SsrShellTemplateService.render('a{{ spaced }}b', {})).toBe('ab');
  });

  it('keeps {{#if}} blocks only for non-empty tokens', () => {
    const template = '{{#if price}}<div>{{price}} EUR</div>{{/if}}{{#if badge}}<span>{{badge}}</span>{{/if}}';
    expect(SsrShellTemplateService.render(template, { price: '30', badge: '' })).toBe('<div>30 EUR</div>');
    expect(SsrShellTemplateService.render(template, { price: '', badge: 'NEW' })).toBe('<span>NEW</span>');
    expect(SsrShellTemplateService.render(template, {})).toBe('');
  });

  it('supports conditional fragments inside attributes', () => {
    const template = '<main class="hero{{#if imageUrl}} has-media{{/if}}">';
    expect(SsrShellTemplateService.render(template, { imageUrl: 'http://x/y.jpg' })).toBe('<main class="hero has-media">');
    expect(SsrShellTemplateService.render(template, { imageUrl: '' })).toBe('<main class="hero">');
  });

  it('inserts raw tokens raw (framework-built css urls)', () => {
    const out = SsrShellTemplateService.render('a{url({{themeAssetBase}}/x.webp)}', {}, {}, {
      themeAssetBase: 'http://api/api/v1/themes/t/ui',
    });
    expect(out).toBe('a{url(http://api/api/v1/themes/t/ui/x.webp)}');
  });

  it('resolves nested conditionals innermost-first', () => {
    const template = '{{#if a}}x{{#if b}}y{{/if}}z{{/if}}';
    expect(SsrShellTemplateService.render(template, { a: 'v', b: 'v' })).toBe('xyz');
    expect(SsrShellTemplateService.render(template, { a: 'v', b: '' })).toBe('xz');
    expect(SsrShellTemplateService.render(template, { a: '', b: 'v' })).toBe('');
  });

  it('never ships leftover template syntax (malformed conditionals)', () => {
    const out = SsrShellTemplateService.render('{{#if a}}x{{/if}}{{/if}}{{#if b}}', { a: 'v' });
    expect(out).not.toContain('{{');
  });
});

describe('SsrShellTemplateService.render — {{#each}} over declared lists', () => {
  const template = '<ul>{{#each navItems}}<li><a href="{{href}}">{{label}}</a></li>{{/each}}</ul>';

  it('repeats the theme-owned body per item, in order', () => {
    const out = SsrShellTemplateService.render(template, {}, {
      navItems: [
        { label: 'Начало', href: '/' },
        { label: 'Магазин', href: '/shop' },
      ],
    });
    expect(out).toBe('<ul><li><a href="/">Начало</a></li><li><a href="/shop">Магазин</a></li></ul>');
  });

  it('escapes item values exactly like scalar tokens', () => {
    const out = SsrShellTemplateService.render(template, {}, {
      navItems: [{ label: '<b>Home</b>', href: '/"onmouseover="x' }],
    });
    expect(out).toBe('<ul><li><a href="/&quot;onmouseover=&quot;x">&lt;b&gt;Home&lt;/b&gt;</a></li></ul>');
  });

  it('renders an empty body for an absent or empty list, leaving no syntax behind', () => {
    expect(SsrShellTemplateService.render(template, {}, { navItems: [] })).toBe('<ul></ul>');
    expect(SsrShellTemplateService.render(template, {}, {})).toBe('<ul></ul>');
  });

  it('sees outer tokens inside the each body', () => {
    const out = SsrShellTemplateService.render('{{#each rows}}[{{siteName}}:{{label}}]{{/each}}', {
      siteName: 'VP',
    }, { rows: [{ label: 'a' }, { label: 'b' }] });
    expect(out).toBe('[VP:a][VP:b]');
  });

  it('resolves {{#if}} inside the each body against the item', () => {
    const out = SsrShellTemplateService.render('{{#each rows}}<i>{{#if badge}}({{badge}}){{/if}}{{label}}</i>{{/each}}', {}, {
      rows: [{ label: 'a', badge: 'NEW' }, { label: 'b', badge: '' }],
    });
    expect(out).toBe('<i>(NEW)a</i><i>b</i>');
  });

  it('lets {{#if listName}} guard an each block by list presence', () => {
    const guarded = `{{#if navItems}}<nav>${template}</nav>{{/if}}`;
    expect(SsrShellTemplateService.render(guarded, {}, { navItems: [{ label: 'A', href: '/a' }] }))
      .toBe('<nav><ul><li><a href="/a">A</a></li></ul></nav>');
    expect(SsrShellTemplateService.render(guarded, {}, { navItems: [] })).toBe('');
  });

  it('never substitutes a list name as a scalar token', () => {
    expect(SsrShellTemplateService.render('<ul>{{navItems}}</ul>', {}, { navItems: [{ label: 'A', href: '/a' }] }))
      .toBe('<ul></ul>');
  });
});

describe('SsrShellTemplateService.buildTokens', () => {
  const model: SsrShellModel = {
    tokens: { heading: 'Title', badge: 'BADGE', imageUrl: 'http://api/uploads/x.jpg' },
    lists: {},
    preloadImageUrl: 'http://api/uploads/x.jpg',
  };
  const config = (tokens: SsrShellThemeConfig['tokens']): SsrShellThemeConfig => ({
    templates: [{ template: 't.html' }],
    tokens,
    lists: [],
  });

  it('adds the framework mechanism tokens alongside the theme-resolved ones', () => {
    const tokens = SsrShellTemplateService.buildTokens(
      model,
      config([{ name: 'imageUrl', from: 'doc', paths: ['content.*.data.imageUrl'], preload: true }]),
      { href: 'http://api/img?w=900', imageSrcSet: 'a 360w', imageSizes: '100vw' },
      'http://api/api/v1/themes/x/ui',
    );
    expect(tokens.heading).toBe('Title');
    expect(tokens.badge).toBe('BADGE');
    expect(tokens.themeAssetBase).toBe('http://api/api/v1/themes/x/ui');
    expect(tokens.preloadSrcSet).toBe('a 360w');
    expect(tokens.preloadSizes).toBe('100vw');
  });

  it('re-points the preload-flagged token at the URL actually preloaded', () => {
    const tokens = SsrShellTemplateService.buildTokens(
      { tokens: { imageUrl: '' }, lists: {}, preloadImageUrl: '' },
      config([{ name: 'imageUrl', from: 'doc', paths: ['content.*.data.imageUrl'], preload: true }]),
      { href: 'http://api/img?w=900', imageSrcSet: 'a 360w' },
      '',
    );
    expect(tokens.imageUrl).toBe('http://api/img?w=900');
  });

  it('leaves tokens untouched when no image was preloaded', () => {
    const tokens = SsrShellTemplateService.buildTokens(
      model,
      config([{ name: 'imageUrl', from: 'doc', paths: ['x'], preload: true }]),
      null,
      '',
    );
    expect(tokens.imageUrl).toBe('http://api/uploads/x.jpg');
    expect(tokens.preloadSrcSet).toBe('');
  });

  it('touches nothing when no token is flagged for preload', () => {
    const tokens = SsrShellTemplateService.buildTokens(
      model,
      config([{ name: 'imageUrl', from: 'doc', paths: ['x'] }]),
      { href: 'http://api/other.jpg' },
      '',
    );
    expect(tokens.imageUrl).toBe('http://api/uploads/x.jpg');
  });
});

describe('SsrShellThemeTemplateLoader.readConfig', () => {
  it('normalizes a templates rule list, dropping unsafe/invalid rules', () => {
    const config = SsrShellThemeTemplateLoader.readConfig({
      ui: {
        ssrShell: {
          templates: [
            { match: { layoutPrefix: 'product.' }, template: 'hero.html' },
            { match: { slugIn: ['about', 'contact'] }, template: 'centered.html' },
            { template: '../../etc/passwd' },
            { template: 'http://evil/x.html' },
            'garbage',
            { template: 'default.html' },
          ],
        },
      },
    });
    expect(config?.templates).toEqual([
      { match: { layoutPrefix: 'product.' }, template: 'hero.html' },
      { match: { slugIn: ['about', 'contact'] }, template: 'centered.html' },
      { template: 'default.html' },
    ]);
  });

  it('normalizes tokens: path shorthand, candidate lists, pick, url kind and preload', () => {
    const config = SsrShellThemeTemplateLoader.readConfig({
      ui: {
        ssrShell: {
          templates: [{ template: 'ssr-shell.html' }],
          css: 'ssr-shell.css',
          tokens: [
            { name: 'siteName', from: 'site', path: ['siteName', 'title'] },
            { name: 'heading', from: 'doc', path: 'content.*', pick: ['heading', 'data.title'] },
            { name: 'imageUrl', from: 'doc', path: 'content.*', pick: ['data.imageUrl'], url: 'asset', preload: true },
            { name: 'bogusUrl', from: 'doc', path: 'x', url: 'ftp' },
          ],
        },
      },
    });
    expect(config?.css).toBe('ssr-shell.css');
    expect(config?.tokens).toEqual([
      { name: 'siteName', from: 'site', paths: ['siteName', 'title'] },
      { name: 'heading', from: 'doc', paths: ['content.*'], pick: ['heading', 'data.title'] },
      { name: 'imageUrl', from: 'doc', paths: ['content.*'], pick: ['data.imageUrl'], url: 'asset', preload: true },
      // An unrecognised url kind is dropped, not obeyed.
      { name: 'bogusUrl', from: 'doc', paths: ['x'] },
    ]);
  });

  it('normalizes list field shorthand', () => {
    const config = SsrShellThemeTemplateLoader.readConfig({
      ui: {
        ssrShell: {
          templates: [{ template: 't.html' }],
          lists: [{
            name: 'navItems',
            from: 'prefetch',
            key: 'nav',
            path: 'items',
            fields: { label: 'label', href: { path: ['url', 'href'], url: 'link' } },
          }],
        },
      },
    });
    expect(config?.lists).toEqual([{
      name: 'navItems',
      from: 'prefetch',
      paths: ['items'],
      fields: { label: { paths: ['label'] }, href: { paths: ['url', 'href'], url: 'link' } },
      key: 'nav',
    }]);
  });

  it('normalizes fonts to theme paths or absolute urls only', () => {
    const config = SsrShellThemeTemplateLoader.readConfig({
      ui: {
        ssrShell: {
          templates: [{ template: 'ssr-shell.html' }],
          fonts: ['fonts/a.woff2', 'https://cdn.example/b.woff2', '../../etc/passwd', '', 42],
        },
      },
    });
    expect(config?.fonts).toEqual(['fonts/a.woff2', 'https://cdn.example/b.woff2']);
  });
});
