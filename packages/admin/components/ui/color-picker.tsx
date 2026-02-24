"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { FrameworkIcons } from '../../lib/icons';
import { RootFramework } from '@fromcode119/react';
import { useTheme } from '../theme-context';
import { getFieldClasses } from '../../lib/ui';

interface ColorPickerProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const HEX_COLOR_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function coerceColorValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    for (const key of Object.keys(localized)) {
      const candidate = localized[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  }
  return '';
}

function normalizeHexColor(value: string): string {
  if (!value) return '';
  const match = value.match(HEX_COLOR_PATTERN);
  if (!match) return '';
  return value.startsWith('#') ? value : `#${value}`;
}

export const ColorPicker = ({ 
  value = "#000000", 
  onChange, 
  disabled, 
  className = "",
  size = "md"
}: ColorPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const rawValue = coerceColorValue(value);
  const normalizedValue = normalizeHexColor(rawValue);
  const pickerValue = normalizedValue || '#000000';

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        left: rect.left
      });
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(event.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`${getFieldClasses(size, `flex items-center gap-3 cursor-pointer ${isOpen ? 'border-indigo-500 ring-4 ring-indigo-500/10' : ''}`)} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            ref={popoverRef}
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
                onClick={() => setIsOpen(false)}
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
};
