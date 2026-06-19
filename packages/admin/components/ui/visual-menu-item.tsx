"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import type { VisualMenuItemProps } from './visual-menu-field.interfaces';

export class VisualMenuItem extends React.Component<VisualMenuItemProps> {
  render(): React.ReactNode {
    const { field, item, index, theme, renderFieldInput, onIndent, onRemove } = this.props;

    return (
      <div
          className={`relative group flex gap-3 transition-all duration-300 animate-in fade-in slide-in-from-left-2`}
          style={{ paddingLeft: `${(item.depth || 0) * 24}px` }}
      >
          {/* Visual Branch Line */}
          {(item.depth || 0) > 0 && (
              <div className="absolute left-0 top-0 bottom-0 flex items-center" style={{ width: `${(item.depth || 0) * 24}px` }}>
                   <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-3 h-[1px] rounded-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
                   <div className={`absolute left-3 top-0 bottom-1/2 w-[1px] rounded-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'} ${index === 0 ? 'hidden' : ''}`} />
              </div>
          )}

          <div className={`flex-1 p-2 rounded-xl border flex items-center gap-2 transition-all ${
              theme === 'dark'
                  ? 'bg-slate-900/40 border-slate-800 group-hover:border-indigo-500/30'
                  : 'bg-white border-slate-200 group-hover:border-indigo-500/30 shadow-sm'
          }`}>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-2">
                  {field.fields.filter((f: any) => !f.admin?.condition || f.admin.condition({}, item)).map((f: any) => (
                      <div key={f.name} className={f.name === 'label' ? 'md:col-span-2' : 'md:col-span-1'}>
                          {renderFieldInput(f, item, index)}
                      </div>
                  ))}
              </div>

              <div className="flex items-center gap-0.5 opacity-20 group-hover:opacity-100 transition-opacity">
                  <button
                      onClick={() => onIndent(index, 'left')}
                      disabled={(item.depth || 0) === 0}
                      className={`p-1.5 rounded-lg transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'} disabled:opacity-0`}
                  >
                      <FrameworkIcons.Left size={12} />
                  </button>
                  <button
                      onClick={() => onIndent(index, 'right')}
                      className={`p-1.5 rounded-lg transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                  >
                      <FrameworkIcons.Right size={12} />
                  </button>
                  <div className={`w-[1px] h-3 mx-0.5 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  <button
                      onClick={() => onRemove(index)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 text-rose-500/40 transition-all ml-0.5"
                  >
                      <FrameworkIcons.Trash size={12} />
                  </button>
              </div>
          </div>
      </div>
    );
  }
}
