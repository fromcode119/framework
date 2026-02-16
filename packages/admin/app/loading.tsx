"use client";

import React from 'react';

export default function GlobalLoading() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="h-16 w-16 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="h-8 w-8 bg-indigo-500/10 rounded-xl animate-pulse"></div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-slate-500 font-semibold text-[11px] tracking-widest animate-pulse">
              Hydrating Interface
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
