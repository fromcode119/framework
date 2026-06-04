import React from 'react';

// Next.js App Router route layout — must be a function component (RSC layouts have no class API).
export default function SettingsLayout({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <div className="flex-1 flex flex-col h-full">
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
