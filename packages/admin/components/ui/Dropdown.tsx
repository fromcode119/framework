"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/components/ThemeContext';

interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: 'default' | 'danger';
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export const Dropdown = ({ trigger, items, align = 'right' }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>

      {isOpen && (
        <div 
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-64 max-w-[calc(100vw-2rem)] origin-top-right rounded-xl border shadow-xl z-[100] animate-in slide-in-from-top-2 duration-200 ${
            theme === 'dark' ? 'bg-[#1e293b] border-slate-700 shadow-black/40' : 'bg-white border-slate-200'
          }`}
        >
          <div className="py-1 px-1">
            {items.map((item) => (
              <button
                key={item.label}
                title={item.label}
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                className={`flex items-center w-full gap-3 px-3 py-2 text-sm font-semibold rounded-lg transition-colors overflow-hidden ${
                  item.variant === 'danger' 
                    ? 'text-rose-500 hover:bg-rose-500/10' 
                    : `${theme === 'dark' ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'}`
                }`}
              >
                {item.icon && <span className="flex-shrink-0 text-slate-400">{item.icon}</span>}
                <span className="truncate text-left flex-1">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
