"use client";

import React from 'react';

export default function StarterHeroPillars() {
  return (
          <div className="sh-grid-wrap mt-24 w-full max-w-5xl">
            <div className="sh-grid-3 sh-grid-panel grid overflow-hidden rounded-2xl text-left sm:grid-cols-3">
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
  );
}
