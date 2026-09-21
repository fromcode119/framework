import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { StorefrontFallbackPage } from '@/runtime/view/storefront-fallback-page.client';
import { FrontendRuntimeConfig } from '@/runtime/frontend-runtime-config';
import { StorefrontPageKind } from '@/runtime/storefront-page-kind';

const configFor = (raw: Record<string, unknown>) => FrontendRuntimeConfig.fromJson(raw);

describe('StorefrontFallbackPage — a 404 stays a 404', () => {
  it('reads a serialized not-found document back as NOT_FOUND', () => {
    // The document renderer writes `pageKind: "not-found"` with `content: null`; if this stopped
    // round-tripping, the fallback would silently take the content branch again.
    const config = configFor({ pageKind: 'not-found', notFoundPath: '/vselena', content: null });
    expect(config.pageKind).toBe(StorefrontPageKind.NOT_FOUND);
    expect(config.pageKind.isNotFound).toBe(true);
    expect(config.notFoundPath).toBe('/vselena');
    expect(config.content).toBeNull();
  });

  it('never renders the empty-content "Untitled" body for a 404', () => {
    // The regression: with no NOT_FOUND branch this fell through to DynamicContentClient, whose
    // null-content body renders `resolveDisplayTitle(null)` — the literal "Untitled" — inside the
    // site's real chrome, at a URL that does not exist.
    const config = configFor({ pageKind: 'not-found', notFoundPath: '/vselena', content: null });
    const markup = renderToStaticMarkup(
      createElement(StorefrontFallbackPage as any, { config, serverHtml: '' }),
    );
    expect(markup).not.toContain('Untitled');
  });

  it('renders the framework 404 body when no theme override is registered', () => {
    const config = configFor({ pageKind: 'not-found', notFoundPath: '/vselena', content: null });
    const markup = renderToStaticMarkup(
      createElement(StorefrontFallbackPage as any, { config, serverHtml: '' }),
    );
    // NotFoundBody is the last link of the override chain; something 404-ish must be on screen.
    expect(markup.length).toBeGreaterThan(0);
    expect(markup).toMatch(/404|not found|Not Found/i);
  });

  it('still routes a content document to the content branch', () => {
    const config = configFor({ pageKind: 'content', content: { title: 'About', content: '<p>hi</p>' } });
    expect(config.pageKind.isNotFound).toBe(false);
    const markup = renderToStaticMarkup(
      createElement(StorefrontFallbackPage as any, { config, serverHtml: '' }),
    );
    expect(markup).toContain('About');
    expect(markup).not.toContain('Untitled');
  });
});
