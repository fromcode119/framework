import type { ReactNode } from 'react';
import { Reactor, bound } from '@fromcode119/reactor';

/**
 * Turns the theme-level `fromcode:navigate` DOM event into a navigation — the islands-runtime twin of
 * `RouterNavigationListener`, which does the same through Next's App Router. There is no router in an
 * islands document (the content routes are static documents with one runtime script), so a navigation
 * is a document load: `location.assign` for a push, `location.replace` for a replace. Same contract for
 * dispatchers (`{ href, replace? }`, same-origin absolute paths only). Renders nothing; the listener is
 * registered through `this.listen`, which removes it on unmount.
 */
export class StorefrontNavigationListener extends Reactor {
  static readonly EVENT = 'fromcode:navigate';

  componentDidMount(): void {
    this.listen(window, StorefrontNavigationListener.EVENT, this.onNavigate as EventListener);
  }

  @bound private onNavigate(event: Event): void {
    const detail = (event as CustomEvent<{ href?: string; replace?: boolean }>).detail;
    const href = String(detail?.href || '').trim();
    if (!href || href.startsWith('http') || !href.startsWith('/')) return;

    if (detail?.replace) {
      window.location.replace(href);
      return;
    }
    window.location.assign(href);
  }

  render(): ReactNode {
    return null;
  }
}
