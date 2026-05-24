"use client";

import React from 'react';
import { Slot, ContextHooks } from '@fromcode119/react';
import { ContentRenderingUtils } from '@/lib/content-rendering-utils';
import { ResolvedContentShape } from '@/lib/resolved-content-shape';
import DefaultPageDesignRenderer from './default-page-design-renderer';

type DynamicContentClientProps = {
  content: any;
};

export default function DynamicContentClient({ content }: DynamicContentClientProps) {
  const { themeLayouts } = ContextHooks.usePlugins();
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
  const hasDefaultPageDesign = Boolean(normalizedContent?.recipe);

  return (
    <LayoutComponent page={normalizedContent}>
      {!shouldBypassDefaultContent ? (
        <div className="w-full" style={{ minHeight: '100svh' }}>
          {hasDefaultPageDesign ? (
            <DefaultPageDesignRenderer content={renderableContent} entry={normalizedContent} />
          ) : (
            <Slot name="frontend.content.display" props={{ content: renderableContent, entry: normalizedContent }} />
          )}

          {(!hasDefaultPageDesign && (!renderableContent || typeof renderableContent === 'string')) && (
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
