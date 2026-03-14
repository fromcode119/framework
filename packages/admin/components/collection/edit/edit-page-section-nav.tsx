"use client";

import React, { useEffect, useRef, useState } from 'react';
import { FrameworkIcons } from '@/lib/icons';

interface SectionNavItem {
  key: string;
  title: string;
}

interface EditPageSectionNavProps {
  sections: SectionNavItem[];
  theme?: string;
}

const MARGIN = 8; // gap below sticky headers

function getStickyHeaderHeight(): number {
  // Global header is h-16 = 64px, always at top
  // EditHeader is sticky top-0 but its bottom edge = its offsetHeight
  // (it sits at 0 in viewport, global header covers the top 64px of it)
  const editHeader = document.querySelector('[data-edit-header]') as HTMLElement | null;
  if (editHeader) {
    return editHeader.offsetHeight + MARGIN;
  }
  return 64 + 70 + MARGIN;
}

export function EditPageSectionNav({ sections, theme }: EditPageSectionNavProps) {
  const [activeKey, setActiveKey] = useState<string>(sections[0]?.key ?? '');
  const [stickyTop, setStickyTop] = useState(130);
  const navRef = useRef<HTMLDivElement>(null);
  const stickyTopRef = useRef<number>(130);

  // Measure actual header height on mount
  useEffect(() => {
    const measure = () => {
      const h = getStickyHeaderHeight();
      stickyTopRef.current = h;
      setStickyTop(h);
    };
    measure();
    const t = setTimeout(measure, 200);
    return () => clearTimeout(t);
  }, []);

  // Scroll-based section detection — finds the last section whose top
  // is at or above the sticky nav position (most reliable approach)
  useEffect(() => {
    if (sections.length === 0) return;
    const onScroll = () => {
      const threshold = window.scrollY + stickyTopRef.current + 20;
      let current = sections[0]?.key ?? '';
      for (const section of sections) {
        const el = document.getElementById(`section-${section.key}`);
        if (el && el.getBoundingClientRect().top + window.scrollY <= threshold) {
          current = section.key;
        }
      }
      setActiveKey(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections]);

  const scrollToSection = (key: string) => {
    const el = document.getElementById(`section-${key}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - stickyTopRef.current;
    window.scrollTo({ top, behavior: 'smooth' });
    setActiveKey(key);
  };

  const activeIndex = sections.findIndex((s) => s.key === activeKey);
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < sections.length - 1;

  if (sections.length < 2) return null;

  const isDark = theme === 'dark';

  return (
    // Outer: self-stretch fills full row height so CSS sticky has room to operate
    <div ref={navRef} className="hidden lg:block select-none self-stretch" style={{ width: 20, zIndex: 200, position: 'relative' }}>
      {/* CSS sticky — no JS transform needed; overflow-x-clip on <main> allows this */}
      <div className="flex flex-col items-center gap-1 pt-1" style={{ position: 'sticky', top: stickyTop }}>
        {/* Up arrow */}
        <button
          onClick={() => hasPrev && scrollToSection(sections[activeIndex - 1].key)}
          className={`p-0.5 rounded transition-all ${hasPrev ? (isDark ? 'text-slate-500 hover:text-slate-200' : 'text-slate-300 hover:text-slate-600') : 'opacity-0 pointer-events-none'}`}
        >
          <FrameworkIcons.ChevronUp size={11} strokeWidth={2.5} />
        </button>

        {/* Dots */}
        <div className="relative flex flex-col items-center">
          <div className={`absolute top-2 bottom-2 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
          {sections.map((section) => {
            const isActive = section.key === activeKey;
            return (
              <div key={section.key} className="relative group flex items-center justify-center py-[5px]">
                <button
                  onClick={() => scrollToSection(section.key)}
                  style={{ position: 'relative', zIndex: 10 }}
                  className={`rounded-full transition-all duration-200 ${
                    isActive
                      ? `w-2.5 h-2.5 ${isDark ? 'bg-indigo-400' : 'bg-indigo-500'} shadow-sm shadow-indigo-500/40`
                      : `w-1.5 h-1.5 ${isDark ? 'bg-slate-600 hover:bg-slate-400' : 'bg-slate-300 hover:bg-slate-500'}`
                  }`}
                />
                {/* Tooltip — must escape the nav's stacking context */}
                <div
                  style={{ position: 'absolute', left: 20, zIndex: 9999, top: '50%', transform: 'translateY(-50%)' }}
                  className={`pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap px-2 py-1 rounded-md text-[11px] font-medium ${
                    isDark
                      ? 'bg-slate-800 text-slate-200 border border-slate-700 shadow-lg'
                      : 'bg-white text-slate-700 border border-slate-200 shadow-md'
                  }`}
                >
                  {section.title}
                </div>
              </div>
            );
          })}
        </div>

        {/* Down arrow */}
        <button
          onClick={() => hasNext && scrollToSection(sections[activeIndex + 1].key)}
          className={`p-0.5 rounded transition-all ${hasNext ? (isDark ? 'text-slate-500 hover:text-slate-200' : 'text-slate-300 hover:text-slate-600') : 'opacity-0 pointer-events-none'}`}
        >
          <FrameworkIcons.ChevronDown size={11} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
