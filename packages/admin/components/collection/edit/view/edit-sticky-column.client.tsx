import type { ReactNode } from 'react';
import { Reactor, prop, state, bound, ref } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';

/**
 * Keeps an edit page's sidebar in view while the form beside it scrolls.
 *
 * A form is usually far longer than its sidebar, so after the first screen the right column was empty
 * for the rest of the page. A sidebar shorter than the window sticks under the page header; one taller
 * than the window scrolls with the page until its own end is in view and stops there, so every part of
 * it can still be reached. That is a single `position: sticky` whose offset is
 * `min(header, window − footer − sidebar height)`, re-measured when the sidebar or the window resizes.
 */
export class EditStickyColumn extends Reactor {
  @prop declare children: ReactNode;
  @ref declare rootRef: Ref<HTMLDivElement>;
  @state top = 0;

  private static readonly GAP = 16;

  @bound private measure(): void {
    const root = this.rootRef.current;
    if (!root) return;
    const header = (document.querySelector('[data-edit-header]') as HTMLElement | null)?.offsetHeight ?? 0;
    const footer = (document.querySelector('[data-edit-footer]') as HTMLElement | null)?.offsetHeight ?? 0;
    const pinned = header + EditStickyColumn.GAP;
    const tallest = window.innerHeight - footer - EditStickyColumn.GAP - root.offsetHeight;
    const next = Math.min(pinned, tallest);
    if (next !== this.top) this.top = next;
  }

  componentDidMount(): void {
    this.measure();
    this.listen(window, 'resize', this.measure, { passive: true });
    const root = this.rootRef.current;
    if (root) {
      const observer = new ResizeObserver(this.measure);
      observer.observe(root);
      this.onUnmount(() => observer.disconnect());
    }
  }

  render(): ReactNode {
    return (
      <div ref={this.rootRef} className="fc-edit-sticky" style={{ top: this.top }}>
        {this.children}
      </div>
    );
  }
}
