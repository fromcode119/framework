"use client";

import React from 'react';
import { Slot, ContextHooks } from '@fromcode119/react';
import { ContentRenderingUtils } from '@/lib/content-rendering-utils';

type DynamicContentClientProps = {
  content: any;
};

export default function DynamicContentClient({ content }: DynamicContentClientProps) {
  const { themeLayouts } = ContextHooks.usePlugins();

  const selectedLayoutName =
    content?.themeLayout ||
    content?.pageTemplate ||
    content?.page_template ||
    'DefaultLayout';
  const LayoutComponent =
    themeLayouts?.[selectedLayoutName] ||
    themeLayouts?.DefaultLayout ||
    (({ children }: any) => <>{children}</>);
  const shouldBypassDefaultContent = ContentRenderingUtils.shouldBypassDefaultContent(LayoutComponent, content);
  const renderableContent = shouldBypassDefaultContent
    ? null
    : ContentRenderingUtils.buildRenderableContent(content);

  return (
    <LayoutComponent page={content}>
      {!shouldBypassDefaultContent ? (
        <div className="w-full">
          <Slot name="frontend.content.display" props={{ content: renderableContent, entry: content }} />

          {((!renderableContent || typeof renderableContent === 'string')) && (
            <div className="prose prose-slate dark:prose-invert max-w-4xl mx-auto py-12 px-6">
              <h1 className="text-4xl font-black mb-8">{ContentRenderingUtils.resolveDisplayTitle(content)}</h1>
              <div dangerouslySetInnerHTML={{ __html: renderableContent || '' }} />
            </div>
          )}

          <Slot name="frontend.content.footer" props={{ content }} />
        </div>
      ) : null}
    </LayoutComponent>
  );
}
