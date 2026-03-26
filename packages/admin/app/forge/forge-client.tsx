"use client";

import { Slot } from '@fromcode119/react';

export function ForgeClient() {
  return (
    <div className="h-full min-h-0 w-full overflow-hidden">
      <Slot
        name="admin.minimal.root"
        fallback={
          <div className="flex h-full min-h-0 items-center justify-center p-6">
            <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Forge</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                No forge extension is registered. Add an admin extension that mounts <code>admin.minimal.root</code>.
              </p>
            </div>
          </div>
        }
      />
    </div>
  );
}
