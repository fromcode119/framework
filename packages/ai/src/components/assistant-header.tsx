'use client';

import React, { useEffect, useState } from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { GLASS_BUTTON, GLASS_CARD } from '../ui/glass-morphism';

export function AssistantHeader({
  showHistory,
  setShowHistory,
  showGateway,
  setShowGateway,
}: {
  showHistory: boolean;
  setShowHistory: (val: boolean) => void;
  showGateway: boolean;
  setShowGateway: (val: boolean) => void;
}) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      setIsDark(false);
    } else {
      html.classList.add('dark');
      setIsDark(true);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-20 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className={`pointer-events-auto ml-auto flex w-fit items-center gap-2 ${GLASS_CARD}`}>
        <button
          type="button"
          onClick={() => { setShowHistory(!showHistory); setShowGateway(false); }}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${showHistory ? 'bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900' : 'bg-white/90 text-slate-600 shadow-sm hover:bg-white hover:shadow dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-800'} backdrop-blur-sm`}
          aria-label="Toggle history"
          title="History"
        >
          <FrameworkIcons.Clock size={18} />
        </button>

        <button
          type="button"
          onClick={() => { setShowGateway(!showGateway); setShowHistory(false); }}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${showGateway ? 'bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900' : 'bg-white/90 text-slate-600 shadow-sm hover:bg-white hover:shadow dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-800'} backdrop-blur-sm`}
          aria-label="Toggle providers"
          title="Providers"
        >
          <FrameworkIcons.Settings size={18} />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Toggle theme"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <FrameworkIcons.Sun size={18} /> : <FrameworkIcons.Moon size={18} />}
        </button>
      </div>
    </div>
  );
}
