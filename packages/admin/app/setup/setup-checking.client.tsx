import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';

/** Shown while the wizard asks whether this installation already has an administrator. */
export class SetupChecking extends PureReactor {
  @prop declare locale: string;

  render(): ReactNode {
    return (
      <div className="min-h-screen flex items-center justify-center fc-canvas">
        <div className="flex flex-col items-center gap-6">
          <div className="animate-spin fc-tone-brand"><FrameworkIcons.Loader size={48} /></div>
          <span className="fc-size-xs font-medium fc-tone-muted tracking-wide">
            {AdminDictionary.translate(this.locale, 'setup.checking')}
          </span>
        </div>
      </div>
    );
  }
}
