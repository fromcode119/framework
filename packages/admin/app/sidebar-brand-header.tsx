import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminPathUtils } from '@/lib/admin-path';
import { AppEnv } from '@/lib/env';
import type { SidebarBrandHeaderProps } from './sidebar-brand-header.interfaces';

const ATLANTIS_MARK_PATH = AdminPathUtils.toAdminPath('/brand/atlantis-mark-indigo.png');

const {
  Close = () => null,
} = (FrameworkIcons || {}) as any;

export class SidebarBrandHeader extends React.Component<SidebarBrandHeaderProps> {
  render(): React.ReactNode {
    const { isMini, platformName, onClose } = this.props;
    return (
      <div className={`p-5 flex items-center shrink-0 ${isMini ? 'justify-center' : 'justify-between'}`}>
        <div className={`flex items-center ${isMini ? 'justify-center px-1' : 'gap-3'}`}>
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30">
            <img src={ATLANTIS_MARK_PATH} alt={`${platformName} mark`} className="h-7 w-7 rounded-lg" />
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
          <Close size={20} />
        </button>
      </div>
    );
  }
}
