"use client";

import React from 'react';
import { RouteConstants } from '@fromcode119/core/client';
import StarterHeroStyles from './starter-hero-styles';
import StarterHeroPillars from './starter-hero-pillars';

const ADMIN_BASE_PATH = RouteConstants.SEGMENTS.ADMIN_BASE;

export default function StarterHero() {
  return (
    <>
      {/* Scoped style reset — defeats any active theme's !important rules */}
      <StarterHeroStyles />

      <div data-sh className="sh-dark-bg relative min-h-screen overflow-hidden bg-[#04080f]">
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
          <StarterHeroPillars />

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
