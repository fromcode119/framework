import type { ReactNode } from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Tells a read-only inspector, on every screen, that it can look but not change: the server refuses
 * every change it tries, and each refusal also says why where it was made.
 */
export class ReadOnlyAccessNotice {
  static render(): ReactNode {
    return (
      <div role="status" className="flex items-center gap-2 border-b fc-tone-warning-line fc-tone-warning-soft px-6 py-2 text-xs font-medium fc-tone-warning lg:px-8">
        <FrameworkIcons.Eye size={14} />
        {AdminI18n.t('shell.readOnlyInspector')}
      </div>
    );
  }
}
