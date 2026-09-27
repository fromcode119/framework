import type { ReactNode } from 'react';
import { FrameworkIcons } from '@fromcode119/react';

/**
 * Tells a read-only inspector, on every screen, that it can look but not change: the server refuses
 * every change it tries, and each refusal also says why where it was made.
 */
export class ReadOnlyAccessNotice {
  static render(): ReactNode {
    return (
      <div role="status" className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 lg:px-8">
        <FrameworkIcons.Eye size={14} />
        Read-only inspector access: you can see everything here, but nothing can be changed.
      </div>
    );
  }
}
