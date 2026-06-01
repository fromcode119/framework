"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';

interface SectionNavItem {
  key: string;
  title: string;
}

interface EditPageSectionNavProps {
  sections: SectionNavItem[];
  theme?: string;
}

interface EditPageSectionNavState {
  activeKey: string;
  stickyTop: number;
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

export class EditPageSectionNav extends React.Component<EditPageSectionNavProps, EditPageSectionNavState> {
  private readonly navRef = React.createRef<HTMLDivElement>();
  private stickyTopValue = 130;
  private measureTimer?: ReturnType<typeof setTimeout>;

  state: EditPageSectionNavState = { activeKey: this.props.sections[0]?.key ?? '', stickyTop: 130 };

  private measure = (): void => {
    const h = getStickyHeaderHeight();
    this.stickyTopValue = h;
    this.setState({ stickyTop: h });
  };

  private handleScroll = (): void => {
    const { sections } = this.props;
    if (sections.length === 0) return;
    const threshold = window.scrollY + this.stickyTopValue + 20;
    let current = sections[0]?.key ?? '';
    for (const section of sections) {
      const el = document.getElementById(`section-${section.key}`);
      if (el && el.getBoundingClientRect().top + window.scrollY <= threshold) {
        current = section.key;
      }
    }
    this.setState({ activeKey: current });
  };

  componentDidMount(): void {
    this.measure();
    this.measureTimer = setTimeout(this.measure, 200);
    if (this.props.sections.length > 0) {
      window.addEventListener('scroll', this.handleScroll, { passive: true });
      this.handleScroll();
    }
  }

  componentDidUpdate(prevProps: EditPageSectionNavProps): void {
    if (prevProps.sections !== this.props.sections) {
      this.handleScroll();
    }
  }

  componentWillUnmount(): void {
    if (this.measureTimer) clearTimeout(this.measureTimer);
    window.removeEventListener('scroll', this.handleScroll);
  }

  private scrollToSection = (key: string): void => {
    const el = document.getElementById(`section-${key}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - this.stickyTopValue;
    window.scrollTo({ top, behavior: 'smooth' });
    this.setState({ activeKey: key });
  };

  render(): React.ReactNode {
    const { sections, theme } = this.props;
    const { activeKey, stickyTop } = this.state;
    const scrollToSection = this.scrollToSection;
    const activeIndex = sections.findIndex((s) => s.key === activeKey);
    const hasPrev = activeIndex > 0;
    const hasNext = activeIndex < sections.length - 1;

    if (sections.length < 2) return null;

    const isDark = theme === 'dark';

    return (
    // Outer: self-stretch fills full row height so CSS sticky has room to operate
    <div ref={this.navRef} className="hidden lg:block select-none self-stretch" style={{ width: 20, zIndex: 200, position: 'relative' }}>
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
}
