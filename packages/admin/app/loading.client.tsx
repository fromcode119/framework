import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/react-class-components';

// Next.js App Router route loading UI — client component, so a class renders fine.
export class GlobalLoading extends PureReactor {
  render(): ReactNode {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="h-16 w-16 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="h-8 w-8 bg-indigo-500/10 rounded-xl animate-pulse"></div>
              </div>
            </div>
            {/*
              * It said "Hydrating Interface" — React's word for attaching its event handlers, shown
              * to whoever opened the page. Plain words instead, and light rather than bold: a line
              * you only read while waiting should not shout.
              */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-[11px] font-medium tracking-tight text-slate-500 dark:text-slate-400">
                Just a moment
              </p>
              <div className="flex gap-1">
                <div className="h-1 w-1 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]"></div>
                <div className="h-1 w-1 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]"></div>
                <div className="h-1 w-1 rounded-full bg-indigo-500 animate-bounce"></div>
              </div>
            </div>
          </div>
      </div>
    );
  }
}
