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

const COMPANY_NAME = 'Fromcode';
const FRAMEWORK_NAME = 'Atlantis';
const FRAMEWORK_TITLE = `${FRAMEWORK_NAME} Framework`;
const FRAMEWORK_DESCRIPTION = 'The open-source platform for building scalable applications.';

function StarterHero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.14),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] dark:bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.2),transparent_38%),linear-gradient(180deg,rgba(2,6,23,1),rgba(15,23,42,0.98))]" />
      <div className="mx-auto flex min-h-[72vh] w-full max-w-6xl flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mt-8 flex flex-col items-center gap-6">
          <img
            src="/brand/atlantis-logo-slate.png"
            alt={`${FRAMEWORK_NAME} by ${COMPANY_NAME} logo`}
            className="hidden h-auto w-full max-w-[420px] dark:hidden sm:block"
          />
          <img
            src="/brand/atlantis-logo-white.png"
            alt={`${FRAMEWORK_NAME} by ${COMPANY_NAME} logo`}
            className="hidden h-auto w-full max-w-[420px] dark:sm:block"
          />
          <div className="space-y-5">
            <h1 className="text-5xl font-black tracking-tight text-slate-950 dark:text-white sm:text-7xl">
              {FRAMEWORK_TITLE}
            </h1>
            <p className="mx-auto max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300 sm:text-xl">
              {FRAMEWORK_DESCRIPTION}
            </p>
            <p className="mx-auto max-w-2xl text-sm font-medium uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Built by {COMPANY_NAME} for teams shipping serious products faster
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href={ADMIN_BASE_PATH}
            className="inline-flex min-w-[180px] items-center justify-center rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
          >
            Go to Admin
          </a>
          <a
            href="https://docs.fromcode.com"
            className="inline-flex min-w-[180px] items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
          >
            Documentation
          </a>
        </div>

        <div className="mt-12 grid w-full max-w-4xl gap-4 text-left sm:grid-cols-3">
          {[
            ['Scalable by default', 'Structured admin, API, and frontend apps ready for real projects.'],
            ['AI-ready workspace', 'Atlantis Intelligence lives inside the platform without locking you into fragile routes.'],
            ['Open-source core', 'Extend themes, plugins, and workflows with a framework designed to be customized.'],
          ].map(([title, copy]) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200/80 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/45"
            >
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
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
