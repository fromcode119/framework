"use client";

import React from 'react';

export default function AboutPage() {
  return (
    <div className="text-center space-y-6 max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
      <h1 className="text-4xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-6xl">
        About Fromcode
      </h1>
      <p className="text-lg text-[var(--foreground)] opacity-70">
        Fromcode Framework is a next-generation extensible platform designed for developers who value modularity and speed.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 w-full">
        <div className="p-6 rounded-xl bg-[var(--foreground)] bg-opacity-5">
          <h3 className="font-bold text-xl mb-2">Modular</h3>
          <p className="text-sm opacity-70">Everything is a plugin. Scale your application by adding or removing features as needed.</p>
        </div>
        <div className="p-6 rounded-xl bg-[var(--foreground)] bg-opacity-5">
          <h3 className="font-bold text-xl mb-2">Themable</h3>
          <p className="text-sm opacity-70">Dynamic runtime theming system that lets you swap the entire look and feel instantly.</p>
        </div>
        <div className="p-6 rounded-xl bg-[var(--foreground)] bg-opacity-5">
          <h3 className="font-bold text-xl mb-2">Performant</h3>
          <p className="text-sm opacity-70">Built on top of Next.js and optimized for modern web standards.</p>
        </div>
      </div>

      <div className="mt-12">
        <a
          href="/"
          className="btn-secondary"
        >
          &larr; Back to Home
        </a>
      </div>
    </div>
  );
}
