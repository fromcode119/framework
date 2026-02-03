"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { RootFramework } from '@fromcode/react';

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
  header?: React.ReactNode;
}

export const Dropdown = ({ trigger, items, align = 'right', header }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 12,
        left: rect.left,
        width: rect.width
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
        triggerRef.current && !triggerRef.current.contains(event.target as Node) &&
        menuRef.current && !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div 
        className="relative inline-block text-left" 
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="cursor-pointer">
          {trigger}
        </div>
      </div>

      {isOpen && (
        <RootFramework>
          <div 
            ref={menuRef}
            style={{
              position: 'fixed',
              top: coords.top,
              left: align === 'right' ? 'auto' : coords.left,
              right: align === 'right' ? window.innerWidth - (coords.left + coords.width) : 'auto',
              minWidth: '20rem'
            }}
            className="w-80 max-w-[calc(100vw-2rem)] origin-top-right rounded-[2rem] border z-[9999] animate-in zoom-in-95 slide-in-from-top-2 duration-500 overflow-hidden 
              bg-white/95 backdrop-blur-2xl border-slate-200/60 shadow-slate-200/50 ring-1 ring-black/[0.02] 
              dark:bg-slate-900/95 dark:border-white/10 dark:ring-1 dark:ring-white/10 dark:shadow-black dark:shadow-[0_30px_90px_-20px_rgba(0,0,0,0.5)]"
          >
            {header && (
              <div className="px-7 py-6 border-b mb-1 relative overflow-hidden border-slate-100 bg-slate-50/50 dark:border-white/5 dark:bg-white/[0.02]">
                <div className="relative z-10">{header}</div>
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-3xl" />
              </div>
            )}
            <div className="p-3 space-y-1">
              {items.map((item, idx) => {
                const isLast = idx === items.length - 1;
                const isDanger = item.variant === 'danger';

                return (
                  <React.Fragment key={item.label}>
                    {isLast && idx !== 0 && (
                      <div className="my-2 h-[1px] mx-4 bg-slate-100 dark:bg-white/5" />
                    )}
                    <button
                      title={item.label}
                      onClick={() => {
                        item.onClick();
                        setIsOpen(false);
                      }}
                      className={`group flex items-center w-full gap-4 px-4 py-3 text-[13px] font-bold rounded-[1.25rem] transition-all duration-300 overflow-hidden relative ${
                        isDanger 
                          ? 'text-rose-500 hover:bg-rose-500/10' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
                      }`}
                    >
                      {item.icon && (
                        <div className={`flex-shrink-0 transition-all duration-300 group-hover:scale-110 h-9 w-9 rounded-xl flex items-center justify-center ${
                          isDanger 
                            ? 'bg-rose-500/10 text-rose-500' 
                            : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-indigo-500/20 dark:group-hover:text-indigo-400'
                        }`}>
                          {item.icon}
                        </div>
                      )}
                      <span className="truncate text-left flex-1 font-black uppercase text-[10px] tracking-[0.15em]">{item.label}</span>
                      
                      {!isDanger && (
                        <div className="h-1.5 w-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-0 group-hover:scale-100 bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.4)] dark:bg-indigo-500 dark:shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                      )}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </RootFramework>
      )}
    </>
  );
};
