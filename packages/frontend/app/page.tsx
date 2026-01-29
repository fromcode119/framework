"use client";

import React from 'react';
import { Slot } from '@fromcode/react';

export default function Home() {
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


