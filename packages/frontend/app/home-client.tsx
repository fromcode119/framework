"use client";

import React from 'react';
import { Slot, ContextHooks } from '@fromcode119/react';
import { ContentRenderingUtils } from '@/lib/content-rendering-utils';
import { ResolvedContentShape } from '@/lib/resolved-content-shape';
import DefaultPageDesignRenderer from './default-page-design-renderer';
import StarterHero from './starter-hero';

type HomeClientProps = {
  initialContent: any | null;
  forcedLayout: string | null;
};

const FRAMEWORK_TITLE = 'Atlantis';

function renderContent(content: any) {
  const rawContent = ContentRenderingUtils.buildRenderableContent(content);
  const hasDefaultPageDesign = Boolean(content?.recipe);
  const hasStringContent = typeof rawContent === 'string' && rawContent.trim().length > 0;
  const hasStructuredContent = Array.isArray(rawContent)
    ? rawContent.length > 0
    : !!(rawContent && typeof rawContent === 'object' && Object.keys(rawContent).length > 0);

  if (!hasStringContent && !hasStructuredContent) {
    return <StarterHero />;
  }

  return (
    <div className="w-full">
      {hasDefaultPageDesign ? (
        <DefaultPageDesignRenderer content={rawContent} entry={content} />
      ) : (
        <Slot name="frontend.content.display" props={{ content: rawContent, entry: content }} />
      )}

      {(!hasDefaultPageDesign && typeof rawContent === 'string') && (
        <div className="prose prose-slate dark:prose-invert max-w-4xl mx-auto py-12 px-6">
          <h1 className="text-4xl font-black mb-8">{ContentRenderingUtils.resolveDisplayTitle(content, FRAMEWORK_TITLE)}</h1>
          <div dangerouslySetInnerHTML={{ __html: rawContent || '' }} />
        </div>
      )}

      <Slot name="frontend.content.footer" props={{ content }} />
    </div>
  );
}

export default function HomeClient({ initialContent, forcedLayout }: HomeClientProps) {
  const { themeLayouts } = ContextHooks.usePlugins();
  const normalizedContent = ResolvedContentShape.normalize((initialContent as Record<string, unknown> | null) || null);

  if (normalizedContent) {
    const selectedLayoutName = ResolvedContentShape.resolveLayoutName(normalizedContent) || 'DefaultLayout';
    const LayoutComponent =
      themeLayouts?.[selectedLayoutName] ||
      themeLayouts?.DefaultLayout ||
      (({ children }: any) => <>{children}</>);
    const shouldBypassDefaultContent = ContentRenderingUtils.shouldBypassDefaultContent(LayoutComponent, normalizedContent);

    return (
      <LayoutComponent page={normalizedContent}>
        {!shouldBypassDefaultContent ? renderContent(normalizedContent) : null}
      </LayoutComponent>
    );
  }

  if (forcedLayout && themeLayouts?.[forcedLayout]) {
    const ForcedLayoutComponent = themeLayouts[forcedLayout];
    return <ForcedLayoutComponent />;
  }

  return <StarterHero />;
}
