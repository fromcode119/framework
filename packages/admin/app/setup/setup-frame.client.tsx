import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AppEnv } from '@/lib/env';
import { AdminClass } from '@/lib/admin-class';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';

/** The chrome around every wizard step: the mark, the heading, the card, the build line. */
export class SetupFrame extends PureReactor {
  @prop declare locale: string;
  @prop declare children: ReactNode;

  /** Name, version and channel, skipping whatever this build did not supply. */
  private get buildLine(): string {
    return [AppEnv.APP_VERSION ? `v${AppEnv.APP_VERSION}` : '', AppEnv.APP_NAME, AppEnv.APP_CHANNEL]
      .filter((part) => part !== '')
      .join(' ');
  }

  render(): ReactNode {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-[#020617]">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-16 h-16 ${AdminClass.SURFACE} mb-4`}>
              <FrameworkIcons.Orbit size={42} className="text-indigo-600 dark:text-indigo-500" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight mb-2 text-slate-950 dark:text-white">
              {AdminDictionary.translate(this.locale, 'setup.title')}
            </h1>
            <p className="text-slate-500 font-medium text-sm leading-relaxed max-w-[340px] mx-auto">
              {AdminDictionary.translate(this.locale, 'setup.subtitle')}
            </p>
          </div>

          <div className={`p-6 sm:p-7 ${AdminClass.SURFACE}`}>{this.children}</div>

          <div className="text-center mt-5 flex items-center justify-center gap-4 opacity-40 text-slate-500">
            <div className="h-[2px] w-8 bg-slate-200 dark:bg-slate-800 rounded-full" />
            <span className="text-[10px] font-semibold tracking-wide">{this.buildLine}</span>
            <div className="h-[2px] w-8 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
        </div>
      </div>
    );
  }
}
