import type { ISectionNavItem } from '@/components/collection/edit/interfaces/section-nav-item.interface';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound, ref } from '@fromcode119/reactor';
import type { Ref } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';

export class EditPageSectionNav extends Reactor {
  /** Gap left below the sticky headers when scrolling a section into view. */
  private static readonly MARGIN = 8;

  private static stickyHeaderHeight(): number {
    // Global header is h-16 = 64px, always at top
    // EditHeader is sticky top-0 but its bottom edge = its offsetHeight
    // (it sits at 0 in viewport, global header covers the top 64px of it)
    const editHeader = document.querySelector('[data-edit-header]') as HTMLElement | null;
    if (editHeader) return editHeader.offsetHeight + EditPageSectionNav.MARGIN;
    return 64 + 70 + EditPageSectionNav.MARGIN;
  }

  @prop declare sections: ISectionNavItem[];
  @prop declare theme?: ThemeMode;

  @ref declare navRef: Ref<HTMLDivElement>;

  // props are not wired when field initialisers run, so seed this once mounted (see componentDidMount)
  @state activeKey = '';
  @state stickyTop = 130;

  private stickyTopValue = 130;
  private measureTimer?: ReturnType<typeof setTimeout>;

  @bound private measure(): void {
    const h = EditPageSectionNav.stickyHeaderHeight();
    this.stickyTopValue = h;
    this.stickyTop = h;
  }

  @bound private handleScroll(): void {
    const { sections } = this;
    if (sections.length === 0) return;
    const threshold = window.scrollY + this.stickyTopValue + 20;
    let current = sections[0]?.key ?? '';
    for (const section of sections) {
      const el = document.getElementById(`section-${section.key}`);
      if (el && el.getBoundingClientRect().top + window.scrollY <= threshold) {
        current = section.key;
      }
    }
    this.activeKey = current;
  }

  componentDidMount(): void {
    if (!this.activeKey) this.activeKey = this.sections?.[0]?.key ?? '';
    this.measure();
    this.measureTimer = setTimeout(this.measure, 200);
    this.onUnmount(() => { if (this.measureTimer) clearTimeout(this.measureTimer); });
    if (this.sections.length > 0) {
      this.listen(window, 'scroll', this.handleScroll, { passive: true });
      this.handleScroll();
    }
  }

  componentDidUpdate(prevProps: { sections: ISectionNavItem[] }): void {
    if (prevProps.sections !== this.sections) {
      this.handleScroll();
    }
  }

  @bound private scrollToSection(key: string): void {
    const el = document.getElementById(`section-${key}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - this.stickyTopValue;
    window.scrollTo({ top, behavior: 'smooth' });
    this.activeKey = key;
  }

  render(): ReactNode {
    const { sections, theme } = this;
    const { activeKey, stickyTop } = this;
    const scrollToSection = this.scrollToSection;
    const activeIndex = sections.findIndex((s) => s.key === activeKey);
    const hasPrev = activeIndex > 0;
    const hasNext = activeIndex < sections.length - 1;

    if (sections.length < 2) return null;

    const isDark = theme === ThemeMode.DARK;

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

        {/* Dots — no connecting rail line: the active dot changes size as you scroll, which shifted the
            stack against the fixed line and made the line look like it was sliding around. */}
        <div className="relative flex flex-col items-center">
          {sections.map((section) => {
            const isActive = section.key === activeKey;
            return (
              <div key={section.key} className="relative group flex items-center justify-center py-[5px]">
                {/* The button keeps a CONSTANT 10px footprint; only the inner dot scales. If the dot
                    itself changed size, every row's height would change as the active section moves,
                    shifting the whole stack on scroll (the "shaking" this replaced). */}
                <button
                  onClick={() => scrollToSection(section.key)}
                  style={{ position: 'relative', zIndex: 10 }}
                  className="w-2.5 h-2.5 flex items-center justify-center"
                >
                  <span
                    className={`rounded-full transition-all duration-200 ${
                      isActive
                        ? `w-2.5 h-2.5 ${isDark ? 'bg-indigo-400' : 'bg-indigo-500'} shadow-sm shadow-indigo-500/40`
                        : `w-1.5 h-1.5 ${isDark ? 'bg-slate-600 group-hover:bg-slate-400' : 'bg-slate-300 group-hover:bg-slate-500'}`
                    }`}
                  />
                </button>
                {/* Tooltip — must escape the nav's stacking context */}
                <div
                  style={{ position: 'absolute', left: 20, zIndex: 9999, top: '50%', transform: 'translateY(-50%)' }}
                  className={`pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap px-2 py-1 rounded-lg text-[11px] font-medium ${
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
