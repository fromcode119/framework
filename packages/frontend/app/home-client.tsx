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

const FRAMEWORK_TITLE = 'Atlantis';

function StarterHero() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-white px-6 py-24 text-center dark:bg-[#080a10]">
      <img
        src="/brand/atlantis-logo-slate.png"
        alt="Atlantis by Fromcode"
        className="block h-auto w-full max-w-[260px] dark:hidden sm:max-w-[320px]"
      />
      <img
        src="/brand/atlantis-logo-white.png"
        alt="Atlantis by Fromcode"
        className="hidden h-auto w-full max-w-[260px] dark:block sm:max-w-[320px]"
      />
      <p className="max-w-[42ch] text-base leading-relaxed text-slate-500 dark:text-slate-400">
        Add homepage content from the admin or install a theme to replace this default view.
      </p>
      <a
        href={ADMIN_BASE_PATH}
        className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
      >
        Go to Admin
      </a>
    </div>
  );
}

function renderContent(content: any) {
  const rawContent = ContentRenderingUtils.buildRenderableContent(content);
  const hasStringContent = typeof rawContent === 'string' && rawContent.trim().length > 0;
  const hasStructuredContent = Array.isArray(rawContent)
    ? rawContent.length > 0
    : !!(rawContent && typeof rawContent === 'object' && Object.keys(rawContent).length > 0);

  if (!hasStringContent && !hasStructuredContent) {
    return <StarterHero />;
  }

  return (
    <div className="w-full">
      <Slot name="frontend.content.display" props={{ content: rawContent }} />

      {(typeof rawContent === 'string') && (
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

  return <StarterHero />;
}
