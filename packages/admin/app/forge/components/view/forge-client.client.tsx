import type React from 'react';
import { PureReactor } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react';
import { AppEnv } from '@/lib/env';
import { AdminClass } from '@/lib/admin-class';

export class ForgeClient extends PureReactor {
  render(): React.ReactNode {
  return (
    <div className="h-full min-h-0 w-full overflow-hidden">
      <Slot
        name="admin.minimal.root"
        fallback={
          <div className="flex h-full min-h-0 items-center justify-center p-6">
            <div className={`max-w-lg ${AdminClass.SURFACE} p-6 text-center`}>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{AppEnv.AI_NAME}</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                No AI workspace extension is registered. Add an admin extension that mounts <code>admin.minimal.root</code>.
              </p>
            </div>
          </div>
        }
      />
    </div>
  );
  }
}
