"use client";

import React from 'react';
import { Slot, usePlugins } from '@fromcode/react';

export default function Home() {
  const { themeLayouts } = usePlugins();

  console.log('[Frontend: Home] themeLayouts available:', Object.keys(themeLayouts || {}));

  // If a theme has registered a Landing or Home layout, give it priority for the root page
  const HomeLayout = themeLayouts?.LandingLayout || themeLayouts?.Home || themeLayouts?.Main || themeLayouts?.['StandardLayout'];

  if (HomeLayout) {
    console.log('[Frontend: Home] Rendering theme layout');
    return <HomeLayout />;
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
        <a
          href="/admin"
          className="btn-primary"
        >
          Go to Admin
        </a>
        <a
          href="https://docs.fromcode.com"
          className="btn-secondary"
        >
          Documentation
        </a>
      </div>
    </div>
  );
}


