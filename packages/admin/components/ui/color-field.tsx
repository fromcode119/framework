"use client";

import React from 'react';
import { HexColorPicker } from 'react-colorful';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';
import { AdminComponent } from '@/components/admin-component';
import type { ColorFieldProps, ColorFieldState } from './color-field.interfaces';

// A compact palette of real colours (hex) — shown INSIDE the popover, never sprawled across the form.
const PRESETS = [
  '#0f172a', '#475569', '#64748b', '#ef4444', '#f97316', '#f59e0b',
  '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
  '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
];

// Legacy values were Tailwind colour NAMES ("indigo", "sky"…) — map to a hex so old records still show right.
const NAME_HEX: Record<string, string> = {
  slate: '#64748b', gray: '#6b7280', red: '#ef4444', orange: '#f97316', amber: '#f59e0b', yellow: '#eab308',
  lime: '#84cc16', green: '#22c55e', emerald: '#10b981', teal: '#14b8a6', cyan: '#06b6d4', sky: '#0ea5e9',
  blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6', purple: '#a855f7', fuchsia: '#d946ef', pink: '#ec4899',
  rose: '#f43f5e',
};

/**
 * The platform colour control: a single compact swatch button that opens a popover with a preset palette + a
 * real visual picker (react-colorful) + a hex input. Stores/emits a HEX (legacy colour names are mapped to a
 * hex for display). The popover renders through a portal at fixed coords so it never clips inside a drawer.
 */
export class ColorField extends AdminComponent<ColorFieldProps, ColorFieldState> {
  private readonly triggerRef = React.createRef<HTMLButtonElement>();
  private readonly popoverRef = React.createRef<HTMLDivElement>();
  state: ColorFieldState = { customOpen: false, coords: { top: 0, left: 0 } };

  private reposition = (): void => {
    const el = this.triggerRef.current;
    if (el) { const r = el.getBoundingClientRect(); this.setState({ coords: { top: r.bottom + 8, left: r.left } }); }
  };
  private onOutside = (e: MouseEvent): void => {
    if (this.triggerRef.current && !this.triggerRef.current.contains(e.target as Node) &&
        this.popoverRef.current && !this.popoverRef.current.contains(e.target as Node)) {
      this.setState({ customOpen: false });
    }
  };
  componentDidMount(): void { document.addEventListener('mousedown', this.onOutside); }
  componentDidUpdate(_p: ColorFieldProps, prev: ColorFieldState): void {
    if (!prev.customOpen && this.state.customOpen) {
      this.reposition();
      window.addEventListener('scroll', this.reposition, true);
      window.addEventListener('resize', this.reposition);
    } else if (prev.customOpen && !this.state.customOpen) {
      window.removeEventListener('scroll', this.reposition, true);
      window.removeEventListener('resize', this.reposition);
    }
  }
  componentWillUnmount(): void {
    document.removeEventListener('mousedown', this.onOutside);
    window.removeEventListener('scroll', this.reposition, true);
    window.removeEventListener('resize', this.reposition);
  }

  private val(): string { return String(this.props.value ?? ''); }
  private isHex(v: string): boolean { return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v); }
  private toHex(v: string): string { if (!v) return ''; if (this.isHex(v)) return v.toLowerCase(); return NAME_HEX[v.toLowerCase()] || ''; }
  private emit(hex: string): void { this.props.onChange(hex); }

  render(): React.ReactNode {
    const disabled = this.props.disabled;
    const current = this.toHex(this.val());
    const open = this.state.customOpen;
    return (
      <>
        <button
          ref={this.triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => this.setState({ customOpen: !open })}
          aria-label="Choose colour"
          className={`inline-flex items-center gap-2.5 h-10 pl-1.5 pr-3 rounded-lg border bg-white dark:bg-slate-900 transition-colors disabled:opacity-50 ${open ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
        >
          <span
            className="h-7 w-7 rounded-md ring-1 ring-black/10 dark:ring-white/15 shrink-0"
            style={current ? { backgroundColor: current } : { background: 'conic-gradient(from 0deg, #ef4444, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)' }}
          />
          <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{current ? 'Colour' : 'Pick a colour'}</span>
          <FrameworkIcons.ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <RootFramework>
            <div
              ref={this.popoverRef}
              style={{ position: 'fixed', top: this.state.coords.top, left: this.state.coords.left, zIndex: 9999 }}
              className={`w-60 p-3 rounded-xl border shadow-2xl animate-in zoom-in-95 slide-in-from-top-2 duration-150 ${this.theme === 'dark' ? 'bg-slate-950 border-white/10' : 'bg-white border-slate-200'}`}
            >
              <div className="grid grid-cols-9 gap-1.5 mb-3">
                {PRESETS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={hex}
                    onClick={() => this.emit(hex)}
                    className={`h-5 w-5 rounded-md transition-transform hover:scale-110 ${current === hex ? 'ring-2 ring-slate-900 dark:ring-white scale-110' : 'ring-1 ring-black/10 dark:ring-white/15'}`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
              <HexColorPicker color={current || '#6366f1'} onChange={(hex) => this.emit(hex)} className="!w-full !h-32 mb-2.5" />
              <input
                type="text"
                value={this.val()}
                placeholder="#6366f1"
                onChange={(e) => this.props.onChange(e.target.value)}
                className={`w-full h-9 rounded-lg border px-3 text-center text-[13px] font-mono outline-none transition-colors ${this.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-indigo-500'}`}
              />
            </div>
          </RootFramework>
        )}
      </>
    );
  }
}
