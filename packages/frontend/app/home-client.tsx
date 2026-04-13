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
    <>
      {/* Scoped style reset — defeats any active theme's !important rules */}
      <style>{`
        [data-sh] {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          text-transform: none !important;
          font-variant: normal !important;
          letter-spacing: normal !important;
          background-color: #04080f !important;
          color: #ffffff !important;
        }
        [data-sh] h1, [data-sh] h2, [data-sh] p, [data-sh] a, [data-sh] span {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          text-transform: none !important;
          font-variant: normal !important;
        }
        [data-sh] h1 {
          color: #ffffff !important;
          font-size: clamp(2.5rem, 6vw, 4.5rem) !important;
          font-weight: 900 !important;
          line-height: 1.05 !important;
          letter-spacing: -0.025em !important;
          text-align: center !important;
          max-width: 56rem !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        [data-sh] h2 {
          color: #ffffff !important;
          font-size: 0.875rem !important;
          font-weight: 700 !important;
          letter-spacing: 0 !important;
        }
        [data-sh] p {
          color: #94a3b8 !important;
          font-size: 1rem !important;
          line-height: 2 !important;
        }
        [data-sh] .sh-grad {
          background: linear-gradient(to right, #818cf8, #a5b4fc, #67e8f9) !important;
          background-clip: text !important;
          -webkit-background-clip: text !important;
          color: transparent !important;
          display: inline !important;
        }
        [data-sh] .sh-muted { color: #475569 !important; font-size: 0.75rem !important; }
        [data-sh] .sh-muted a { color: #64748b !important; }
        [data-sh] * { box-sizing: border-box; }
        [data-sh] .sh-center { text-align: center !important; }
        [data-sh] .sh-cta-row {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0.75rem !important;
          flex-wrap: wrap !important;
          margin-top: 2.5rem !important;
        }
        [data-sh] .sh-btn-primary {
          display: inline-flex !important; align-items: center !important; justify-content: center !important;
          padding: 0.875rem 2rem !important; border-radius: 9999px !important;
          background-color: #4f46e5 !important; color: #ffffff !important;
          font-size: 0.875rem !important; font-weight: 700 !important;
          text-decoration: none !important; white-space: nowrap !important;
          box-shadow: 0 0 48px rgba(99,102,241,0.4) !important;
          min-width: 196px !important;
        }
        [data-sh] .sh-btn-secondary {
          display: inline-flex !important; align-items: center !important; justify-content: center !important;
          padding: 0.875rem 2rem !important; border-radius: 9999px !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          background-color: rgba(255,255,255,0.04) !important; color: #cbd5e1 !important;
          font-size: 0.875rem !important; font-weight: 700 !important;
          text-decoration: none !important; white-space: nowrap !important;
          min-width: 196px !important;
        }
        [data-sh] .sh-grid-3 { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        [data-sh] .sh-grid-wrap { margin-top: 5rem !important; width: 100% !important; max-width: 64rem !important; }
        [data-sh] .sh-pillar {
          display: flex !important; flex-direction: column !important; gap: 1rem !important;
          padding: 2rem !important;
        }
        [data-sh] .sh-feat-icon {
          font-size: 1.5rem !important; line-height: 1 !important;
          display: block !important; margin-bottom: 0.5rem !important;
        }
        [data-sh] .sh-footnote { margin-top: 4rem !important; padding-bottom: 2rem !important; }
        @media (max-width: 639px) {
          [data-sh] .sh-grid-3 { grid-template-columns: 1fr !important; }
          [data-sh] .sh-cta-row { flex-direction: column !important; }
        }
      `}</style>

      <div data-sh className="relative min-h-screen overflow-hidden bg-[#04080f]">
        {/* Layered deep-ocean atmosphere */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(79,70,229,0.18),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_10%_60%,rgba(99,102,241,0.07),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_90%_80%,rgba(6,182,212,0.06),transparent)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_60%,rgba(4,8,15,0.8)_100%)]" />
          {/* Micro grid */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:80px_80px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_40%,black,transparent)]" />
        </div>

        <div className="sh-center relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-28 text-center">

          {/* Logo */}
          <div className="mb-14">
            <img
              src="/brand/atlantis-logo-white.png"
              alt="Atlantis by Fromcode"
              className="mx-auto h-auto w-full max-w-[180px] opacity-95 sm:max-w-[220px]"
            />
          </div>

          {/* Headline */}
          <h1 className="mx-auto max-w-4xl">
            The framework that{' '}
            <span className="sh-grad bg-gradient-to-r from-indigo-400 via-indigo-300 to-cyan-400 bg-clip-text">
              doesn&apos;t get in your&nbsp;way
            </span>
            .
          </h1>

          <p className="mx-auto mt-7 max-w-xl">
            Atlantis is the open-source full-stack platform by Fromcode for teams
            who want to build production-grade applications — fast, composable, and on their own terms.
          </p>

          {/* CTAs */}
          <div className="sh-cta-row mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <a
              href={ADMIN_BASE_PATH}
              className="sh-btn-primary inline-flex min-w-[196px] items-center justify-center rounded-full bg-indigo-600 px-8 py-3.5 text-sm font-bold text-white shadow-[0_0_48px_rgba(99,102,241,0.4)] transition-all duration-300 hover:bg-indigo-500 hover:shadow-[0_0_64px_rgba(99,102,241,0.55)]"
            >
              Open Admin →
            </a>
            <a
              href="https://docs.fromcode.com"
              className="sh-btn-secondary inline-flex min-w-[196px] items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-8 py-3.5 text-sm font-bold text-slate-300 backdrop-blur transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              Documentation
            </a>
          </div>

          {/* Feature pillars */}
          <div className="sh-grid-wrap mt-24 w-full max-w-5xl">
            <div className="sh-grid-3 grid overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] text-left sm:grid-cols-3">
              {[
                {
                  color: '#818cf8',
                  icon: (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="M2 12l10 5 10-5"/>
                      <path d="M2 17l10 5 10-5"/>
                    </svg>
                  ),
                  title: 'Full-stack in one repo',
                  body: 'Admin panel, REST API, and frontend ship together. No glue code, no ceremony — just your product.',
                },
                {
                  color: '#22d3ee',
                  icon: (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                      <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                  ),
                  title: 'Isolated plugin system',
                  body: 'Every plugin is a sealed module. They communicate through a typed event bus without touching each other.',
                },
                {
                  color: '#a78bfa',
                  icon: (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9"/>
                      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                  ),
                  title: 'Theme-swappable UI',
                  body: 'Replace the entire visual layer at runtime. Layouts, styles, and components — all owned by the theme.',
                },
              ].map(({ color, icon, title, body }, i) => (
                <div
                  key={title}
                  className={`sh-pillar group flex flex-col gap-4 p-8 transition-colors duration-300 hover:bg-white/[0.03] ${i < 2 ? 'sm:border-r border-white/[0.07]' : ''}`}
                >
                  <div
                    aria-hidden="true"
                    style={{ marginBottom: '0.75rem', color }}
                  >{icon}</div>
                  <h2>{title}</h2>
                  <p className="transition-colors duration-300 group-hover:text-slate-400">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Ambient footnote */}
          <p className="sh-muted sh-footnote mt-16">
            Built by{' '}
            <a href="https://fromcode.com" className="underline decoration-slate-700 underline-offset-4 transition-colors hover:text-slate-400">
              Fromcode
            </a>
            {' '}— Publish homepage content from the Admin to replace this page.
          </p>
        </div>
      </div>
    </>
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
