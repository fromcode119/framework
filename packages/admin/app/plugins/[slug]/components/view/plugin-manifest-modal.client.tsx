import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { AdminClass } from '@/lib/admin-class';

export class PluginManifestModal extends PureReactor {
  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  @prop declare plugin: ILoadedPlugin;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const { isOpen, onClose, plugin, theme } = this;
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className={`relative w-full max-w-2xl max-h-[80vh] flex flex-col ${AdminClass.SURFACE} overflow-hidden border ${theme === ThemeMode.DARK ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`} onClick={(event) => event.stopPropagation()}>
          <div className={`flex items-center justify-between px-8 py-5 border-b ${theme === ThemeMode.DARK ? 'border-white/5' : 'border-slate-100'}`}>
            <h3 className={`text-[11px] font-semibold uppercase tracking-wider ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>
              Plugin Manifest — {plugin.manifest.slug}
            </h3>
            <button onClick={onClose} className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${theme === ThemeMode.DARK ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}>
              <FrameworkIcons.X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <pre className={`p-8 text-[11px] leading-relaxed font-mono ${theme === ThemeMode.DARK ? 'text-slate-300' : 'text-slate-700'}`}>
              {JSON.stringify(plugin, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  }
}
