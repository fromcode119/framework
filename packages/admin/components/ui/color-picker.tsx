"use client";

import React from 'react';
import { HexColorPicker } from 'react-colorful';
import { FrameworkIcons } from '@fromcode119/react';
import { RootFramework } from '@fromcode119/react';
import { AdminComponent } from '@/components/admin-component';
import { UiFieldUtils } from '@/lib/ui';
import { ColorPickerUtils } from './color-picker-utils';

interface ColorPickerProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

interface ColorPickerState {
  isOpen: boolean;
  coords: { top: number; left: number };
}

export class ColorPicker extends AdminComponent<ColorPickerProps, ColorPickerState> {
  private readonly containerRef = React.createRef<HTMLDivElement>();
  private readonly popoverRef = React.createRef<HTMLDivElement>();

  state: ColorPickerState = { isOpen: false, coords: { top: 0, left: 0 } };

  private updatePosition = (): void => {
    if (this.containerRef.current) {
      const rect = this.containerRef.current.getBoundingClientRect();
      this.setState({ coords: { top: rect.bottom + 8, left: rect.left } });
    }
  };

  private handleClickOutside = (event: MouseEvent): void => {
    if (
      this.containerRef.current && !this.containerRef.current.contains(event.target as Node) &&
      this.popoverRef.current && !this.popoverRef.current.contains(event.target as Node)
    ) {
      this.setState({ isOpen: false });
    }
  };

  private addPositionListeners(): void {
    this.updatePosition();
    window.addEventListener('scroll', this.updatePosition, true);
    window.addEventListener('resize', this.updatePosition);
  }

  private removePositionListeners(): void {
    window.removeEventListener('scroll', this.updatePosition, true);
    window.removeEventListener('resize', this.updatePosition);
  }

  componentDidMount(): void {
    document.addEventListener('mousedown', this.handleClickOutside);
    if (this.state.isOpen) this.addPositionListeners();
  }

  componentDidUpdate(_prevProps: ColorPickerProps, prevState: ColorPickerState): void {
    if (prevState.isOpen !== this.state.isOpen) {
      if (this.state.isOpen) this.addPositionListeners();
      else this.removePositionListeners();
    }
  }

  componentWillUnmount(): void {
    document.removeEventListener('mousedown', this.handleClickOutside);
    this.removePositionListeners();
  }

  render(): React.ReactNode {
    const { value = '#000000', onChange, disabled, className = '', size = 'md' } = this.props;
    const { isOpen, coords } = this.state;
    const theme = this.theme;
    const rawValue = ColorPickerUtils.coerceColorValue(value);
    const normalizedValue = ColorPickerUtils.normalizeHexColor(rawValue);
    const pickerValue = normalizedValue || '#000000';

    return (
    <div className={`relative ${className}`} ref={this.containerRef}>
      <div
        onClick={() => !disabled && this.setState({ isOpen: !isOpen })}
        className={`${UiFieldUtils.getFieldClasses(size, `flex items-center gap-3 cursor-pointer ${isOpen ? 'border-indigo-500 ring-4 ring-indigo-500/10' : ''}`)} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div 
          className="w-8 h-5 rounded border border-white/10 dark:border-white/20 shadow-sm"
          style={{ backgroundColor: pickerValue }}
        />
        <span className="font-mono uppercase tracking-tighter flex-1">{rawValue || pickerValue}</span>
        <FrameworkIcons.Palette size={14} className="text-slate-400" />
      </div>

      {isOpen && (
        <RootFramework>
          <div
            ref={this.popoverRef}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              zIndex: 9999
            }}
            className={`p-5 rounded-lg border animate-in zoom-in-95 slide-in-from-top-2 duration-300 shadow-2xl
              ${theme === 'dark' 
                ? 'bg-slate-950/95 border-white/10 backdrop-blur-3xl' 
                : 'bg-white/95 border-slate-200 shadow-slate-200 backdrop-blur-3xl'}`}
          >
            <HexColorPicker color={pickerValue} onChange={onChange} className="mb-6 !w-full !h-48" />
            
            <div className="flex flex-col gap-4">
               <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold tracking-wide text-slate-400">Hex Code</span>
                  <div className="h-px flex-1 bg-slate-100 dark:bg-white/5" />
               </div>
               <input 
                 type="text"
                 value={rawValue}
                 onChange={(e) => onChange(e.target.value)}
                 className={`w-full h-10 rounded-lg border text-center font-mono font-semibold transition-all outline-none ${
                   theme === 'dark' 
                     ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' 
                     : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-indigo-500 shadow-inner'
                 }`}
               />
            </div>
            
            <div className={`mt-6 pt-6 border-t flex justify-end ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
               <button
                onClick={() => this.setState({ isOpen: false })}
                className="w-full h-10 bg-indigo-600 text-white rounded-lg text-[10px] font-semibold tracking-wide hover:bg-indigo-700 shadow-lg shadow-indigo-600/10 transition-all active:scale-[0.98]"
               >
                 Confirm Color
               </button>
            </div>
          </div>
        </RootFramework>
      )}
    </div>
    );
  }
}
