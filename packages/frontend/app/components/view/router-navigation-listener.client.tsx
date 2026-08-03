import { Reactor, bound, prop } from '@fromcode119/reactor';
import type { ReactNode } from 'react';
import type { useRouter } from 'next/navigation';

/**
 * Turns the theme-level `fromcode:navigate` DOM event into a real App Router navigation, so themes
 * can request navigation without importing `next/navigation`. Renders nothing. The listener is
 * registered through `this.listen`, which removes it on unmount.
 */
export class RouterNavigationListener extends Reactor {
  @prop declare router: ReturnType<typeof useRouter>;

  componentDidMount(): void {
    this.listen(window, 'fromcode:navigate', this.onNavigate as EventListener);
  }

  @bound private onNavigate(event: Event): void {
    const detail = (event as CustomEvent<{ href?: string; replace?: boolean }>).detail;
    const href = String(detail?.href || '').trim();
    if (!href || href.startsWith('http') || !href.startsWith('/')) return;

    if (detail?.replace) {
      this.router.replace(href);
      this.router.refresh();
      return;
    }
    this.router.push(href);
    this.router.refresh();
  }

  render(): ReactNode {
    return null;
  }
}
