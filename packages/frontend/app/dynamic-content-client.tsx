"use client";

import React from 'react';
import { Slot, ContextHooks } from '@fromcode119/react';
import { ContentRenderingUtils } from '@/lib/content-rendering-utils';
import { ResolvedContentShape } from '@/lib/resolved-content-shape';

type DynamicContentClientProps = {
  content: any;
  lcpImageUrl?: string | null;
};

function LcpHeroPlaceholder({ imageUrl }: { imageUrl: string }) {
  return (
    <div style={{ paddingTop: '70px', display: 'flex', flexDirection: 'row', gap: '3rem', alignItems: 'center', maxWidth: '1200px', margin: '0 auto', padding: '70px 1.5rem 3rem' }}>
      <div style={{ flex: '1', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <img
          src={imageUrl}
          alt=""
          fetchPriority="high"
          loading="eager"
          decoding="async"
          style={{ width: '100%', maxWidth: '500px', height: '400px', objectFit: 'cover', borderRadius: '16px', display: 'block' }}
        />
      </div>
      <div style={{ flex: '1' }} />
    </div>
  );
}

export default function DynamicContentClient({ content, lcpImageUrl }: DynamicContentClientProps) {
  const { themeLayouts } = ContextHooks.usePlugins();
  const themeLoaded = Boolean(themeLayouts?.DefaultLayout);
  const normalizedContent = ResolvedContentShape.normalize((content as Record<string, unknown> | null) || null);

  const selectedLayoutName = ResolvedContentShape.resolveLayoutName(normalizedContent) || 'DefaultLayout';
  const LayoutComponent =
    themeLayouts?.[selectedLayoutName] ||
    themeLayouts?.DefaultLayout ||
    (({ children }: any) => <>{children}</>);
  const shouldBypassDefaultContent = ContentRenderingUtils.shouldBypassDefaultContent(LayoutComponent, normalizedContent);
  const renderableContent = shouldBypassDefaultContent
    ? null
    : ContentRenderingUtils.buildRenderableContent(normalizedContent);

  return (
    <LayoutComponent page={normalizedContent}>
      {!shouldBypassDefaultContent ? (
        <div className="w-full" style={{ minHeight: '100svh' }}>
          {!themeLoaded && lcpImageUrl ? <LcpHeroPlaceholder imageUrl={lcpImageUrl} /> : null}

          <Slot name="frontend.content.display" props={{ content: renderableContent, entry: normalizedContent }} />

          {((!renderableContent || typeof renderableContent === 'string')) && (
            <div className="prose prose-slate dark:prose-invert max-w-4xl mx-auto py-12 px-6">
              <h1 className="text-4xl font-black mb-8">{ContentRenderingUtils.resolveDisplayTitle(normalizedContent)}</h1>
              <div dangerouslySetInnerHTML={{ __html: renderableContent || '' }} />
            </div>
          )}

          <Slot name="frontend.content.footer" props={{ content: normalizedContent }} />
        </div>
      ) : null}
    </LayoutComponent>
  );
}
