"use client";

import React from 'react';
import { Slot } from '@fromcode/react';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-2xl">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
          Fromcode Framework
        </h1>
        <p className="text-lg text-slate-600">
          The open-source platform for building scalable applications.
        </p>

        <Slot name="frontend.home.hero" />

        <div className="flex gap-4 justify-center">
          <a
            href="/admin"
            className="rounded-full bg-slate-900 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition-all"
          >
            Go to Admin
          </a>
          <a
            href="https://docs.fromcode.com"
            className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition-all"
          >
            Documentation
          </a>
        </div>
      </div>
    </main>
  );
}


