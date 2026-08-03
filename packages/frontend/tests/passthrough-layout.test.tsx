import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PassthroughLayout } from '@/components/view/passthrough-layout.client';
import { ContentRenderingUtils } from '@/lib/content-rendering-utils';

/**
 * Regression for the pre-theme layout fallback in DynamicContentClient / HomeClient.
 * The fallback used to be an inline arrow component created on every render — a NEW component
 * type each time, so React remounted the entire content subtree on every context update while
 * `themeLayouts` was still empty (layout churn / CLS). The fallback must be a single
 * module-level component with stable identity and unchanged render + bypass semantics.
 */
describe('PassthroughLayout', () => {
  it('is a stable module-level component (same identity on every resolution)', async () => {
    const again = await import('@/components/view/passthrough-layout.client');
    expect(again.PassthroughLayout).toBe(PassthroughLayout);
  });

  it('renders its children unchanged, with no extra markup', () => {
    const html = renderToStaticMarkup(
      <PassthroughLayout>
        <div id="content">hello</div>
      </PassthroughLayout>,
    );
    expect(html).toBe('<div id="content">hello</div>');
  });

  it('renders nothing when given no children', () => {
    expect(renderToStaticMarkup(<PassthroughLayout />)).toBe('');
  });

  it('keeps the old fallback semantics for shouldBypassDefaultContent (never bypasses)', () => {
    expect(ContentRenderingUtils.shouldBypassDefaultContent(PassthroughLayout, { slug: 'about' })).toBe(false);
  });
});
