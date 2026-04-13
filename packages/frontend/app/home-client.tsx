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
const FRAMEWORK_DESCRIPTION = 'Atlantis by Fromcode, the open-source platform for building scalable applications.';

function StarterHero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.08),transparent_36%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] dark:bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.12),transparent_38%),linear-gradient(180deg,rgba(2,6,23,1),rgba(15,23,42,0.98))]" />
      <div className="mx-auto flex min-h-[72vh] w-full max-w-6xl flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-4xl rounded-[2rem] border border-slate-200/80 bg-white/85 px-8 py-12 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
          <div className="mx-auto inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Default Starter Page
          </div>
          <div className="mt-6 space-y-5">
            <div className="flex justify-center">
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
            </div>
            <p className="mx-auto max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300 sm:text-xl">
              {FRAMEWORK_DESCRIPTION}
            </p>
            <p className="mx-auto max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400 sm:text-base">
              Your frontend is live. Publish homepage content or install a theme layout to replace this placeholder with your project branding.
            </p>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href={ADMIN_BASE_PATH}
              className="inline-flex min-w-[180px] items-center justify-center rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Go to Admin
            </a>
            <a
              href="https://docs.fromcode.com"
              className="inline-flex min-w-[180px] items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-500 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
            >
              Documentation
            </a>
          </div>

          <div className="mt-12 grid w-full max-w-4xl gap-4 text-left sm:grid-cols-3">
            {[
              ['Admin + API + Frontend', 'The starter stack is already wired so you can move from setup to shipped features without restructuring the app.'],
              ['Theme-first frontend', 'Replace this fallback by publishing homepage content or supplying a theme layout with your own visual system.'],
              ['Open framework surface', 'Plugins, themes, and workflows stay extensible while Atlantis branding remains the default runtime experience.'],
            ].map(([title, copy]) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/45"
              >
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{copy}</p>
              </div>
            ))}
          </div>
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
