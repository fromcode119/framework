import { describe, it, expect } from 'vitest';
import { SsrShellTemplateMatcher } from '../lib/ssr-shell/ssr-shell-template-matcher';
import type { SsrShellTemplateRule } from '../lib/ssr-shell/ssr-shell-theme-template.types';

const rules: SsrShellTemplateRule[] = [
  { match: { slugIn: ['about', 'contact', 'login', 'register'] }, template: 'centered.html' },
  { match: { layoutPrefix: 'product.' }, template: 'hero.html' },
  { match: { slugIn: ['home', ''] }, template: 'home.html' },
  { template: 'default.html' },
];

describe('SsrShellTemplateMatcher.select', () => {
  it('matches slugIn exactly', () => {
    expect(SsrShellTemplateMatcher.select(rules, { slug: 'about', layout: 'page.default' })).toBe('centered.html');
    expect(SsrShellTemplateMatcher.select(rules, { slug: 'aboutx', layout: 'page.default' })).toBe('default.html');
  });

  it('matches layoutPrefix', () => {
    expect(SsrShellTemplateMatcher.select(rules, { slug: 'numerology/consultation', layout: 'product.editorial' })).toBe('hero.html');
    expect(SsrShellTemplateMatcher.select(rules, { slug: 'cosmic-box', layout: 'product.collection' })).toBe('hero.html');
  });

  it('matches the home slug, including the empty slug', () => {
    expect(SsrShellTemplateMatcher.select(rules, { slug: 'home', layout: 'DefaultLayout' })).toBe('home.html');
    expect(SsrShellTemplateMatcher.select(rules, { slug: '', layout: '' })).toBe('home.html');
  });

  it('first matching rule wins', () => {
    // 'about' also has no product layout, but the slug rule comes first anyway.
    const reordered: SsrShellTemplateRule[] = [
      { match: { layoutIn: ['page.default'] }, template: 'first.html' },
      { match: { slugIn: ['about'] }, template: 'second.html' },
    ];
    expect(SsrShellTemplateMatcher.select(reordered, { slug: 'about', layout: 'page.default' })).toBe('first.html');
  });

  it('applies all match keys as AND', () => {
    const combined: SsrShellTemplateRule[] = [
      { match: { slugPrefix: 'numerology/', layoutPrefix: 'product.' }, template: 'both.html' },
      { template: 'default.html' },
    ];
    expect(SsrShellTemplateMatcher.select(combined, { slug: 'numerology/consultation', layout: 'product.editorial' })).toBe('both.html');
    expect(SsrShellTemplateMatcher.select(combined, { slug: 'numerology/consultation', layout: 'page.default' })).toBe('default.html');
    expect(SsrShellTemplateMatcher.select(combined, { slug: 'shop/x', layout: 'product.editorial' })).toBe('default.html');
  });

  it('is case-insensitive and trims values', () => {
    expect(SsrShellTemplateMatcher.select(rules, { slug: ' About ', layout: '' })).toBe('centered.html');
    expect(SsrShellTemplateMatcher.select(rules, { slug: 'x', layout: 'PRODUCT.Editorial' })).toBe('hero.html');
  });

  it('returns empty string when no rule matches and there is no catch-all', () => {
    const strict: SsrShellTemplateRule[] = [{ match: { slugIn: ['a'] }, template: 'a.html' }];
    expect(SsrShellTemplateMatcher.select(strict, { slug: 'b', layout: '' })).toBe('');
    expect(SsrShellTemplateMatcher.select([], { slug: 'b', layout: '' })).toBe('');
  });

  it('supports layoutIn exact matching', () => {
    const byLayout: SsrShellTemplateRule[] = [
      { match: { layoutIn: ['page.canvas'] }, template: 'canvas.html' },
      { template: 'default.html' },
    ];
    expect(SsrShellTemplateMatcher.select(byLayout, { slug: 'vision-board', layout: 'page.canvas' })).toBe('canvas.html');
    expect(SsrShellTemplateMatcher.select(byLayout, { slug: 'vision-board', layout: 'page.default' })).toBe('default.html');
  });
});
