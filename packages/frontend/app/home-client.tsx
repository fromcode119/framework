"use client";

import React from 'react';
import { Slot, ContextHooks } from '@fromcode119/react';
import { RouteConstants } from '@fromcode119/core/client';
import { ContentRenderingUtils } from '@/lib/content-rendering-utils';

const ADMIN_BASE_PATH = RouteConstants.SEGMENTS.ADMIN_BASE;

type HomeClientProps = {
  initialContent: any | null;
  forcedLayout: string | null;
};

function renderContent(content: any) {
  const rawContent = ContentRenderingUtils.buildRenderableContent(content);
  const hasStringContent = typeof rawContent === 'string' && rawContent.trim().length > 0;
  const hasStructuredContent = Array.isArray(rawContent)
    ? rawContent.length > 0
    : !!(rawContent && typeof rawContent === 'object' && Object.keys(rawContent).length > 0);

  if (!hasStringContent && !hasStructuredContent) {
    return (
      <div className="text-center space-y-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-6xl">
          {content?.title || 'Fromcode Framework'}
        </h1>
        <p className="text-lg text-[var(--foreground)] opacity-70">
          Your frontend is running. Add/publish homepage content to replace this starter view.
        </p>
        <div className="flex gap-4 justify-center">
          <a href={ADMIN_BASE_PATH} className="btn-primary">
            Go to Admin
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Slot name="frontend.content.display" props={{ content: rawContent }} />

      {(typeof rawContent === 'string') && (
        <div className="prose prose-slate dark:prose-invert max-w-4xl mx-auto py-12 px-6">
          <h1 className="text-4xl font-black mb-8">{ContentRenderingUtils.resolveDisplayTitle(content, 'Fromcode Framework')}</h1>
          <div dangerouslySetInnerHTML={{ __html: rawContent || '' }} />
        </div>
      )}

      <Slot name="frontend.content.footer" props={{ content }} />
    </div>
  );
}

export default function HomeClient({ initialContent, forcedLayout }: HomeClientProps) {
  const { themeLayouts } = ContextHooks.usePlugins();

  if (initialContent) {
    const selectedLayoutName =
      initialContent?.themeLayout ||
      initialContent?.pageTemplate ||
      initialContent?.page_template ||
      'DefaultLayout';
    const LayoutComponent =
      themeLayouts?.[selectedLayoutName] ||
      themeLayouts?.DefaultLayout ||
      (({ children }: any) => <>{children}</>);
    const shouldBypassDefaultContent = ContentRenderingUtils.shouldBypassDefaultContent(LayoutComponent, initialContent);

    return (
      <LayoutComponent page={initialContent}>
        {!shouldBypassDefaultContent ? renderContent(initialContent) : null}
      </LayoutComponent>
    );
  }

  if (forcedLayout && themeLayouts?.[forcedLayout]) {
    const ForcedLayoutComponent = themeLayouts[forcedLayout];
    return <ForcedLayoutComponent />;
  }

  return (
    <div className="text-center space-y-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
      <h1 className="text-4xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-6xl">
        Fromcode Framework
      </h1>
      <p className="text-lg text-[var(--foreground)] opacity-70">
        The open-source platform for building scalable applications.
      </p>
      <div className="flex gap-4 justify-center">
        <a href={ADMIN_BASE_PATH} className="btn-primary">
          Go to Admin
        </a>
        <a href="https://docs.fromcode.com" className="btn-secondary">
          Documentation
        </a>
      </div>
    </div>
  );
}
