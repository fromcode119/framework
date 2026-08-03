import type { ReactNode } from 'react';

import { FrameworkIcons } from '@fromcode119/react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { AdminPathUtils } from '@/lib/admin-path';
import { AppEnv } from '@/lib/env';
import { AdminClass } from '@/lib/admin-class';
export class SidebarBrandHeader extends PureReactor {
  private static readonly BRAND_MARK_PATH = AdminPathUtils.toAdminPath(AppEnv.BRAND_MARK_PATH);
  @prop declare isMini: boolean | undefined;
  @prop declare platformName: string;
  @prop declare onClose: (() => void) | undefined;

  render(): ReactNode {
    const isMini = this.isMini;
    const platformName = this.platformName;
    const onClose = this.onClose;
    return (
      <div className={`px-4 py-3.5 flex items-center shrink-0 ${isMini ? 'justify-center' : 'justify-between'}`}>
        <div className={`flex items-center ${isMini ? 'justify-center px-1' : 'gap-3'}`}>
          <div className={`flex h-9 w-9 items-center justify-center overflow-hidden ${AdminClass.SURFACE}`}>
            <img src={SidebarBrandHeader.BRAND_MARK_PATH} alt={`${platformName} mark`} className="h-7 w-7 rounded-lg" />
          </div>
          {!isMini && (
            <div className={`flex flex-col`}>
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-none">
                {platformName}
              </span>
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mt-1 leading-none">
                by {AppEnv.COMPANY_NAME}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <FrameworkIcons.Close size={20} />
        </button>
      </div>
    );
  }
}
