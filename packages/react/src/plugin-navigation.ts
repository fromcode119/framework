import { Platform } from '@fromcode119/react-class-components';

/**
 * How a plugin UI component navigates — the contract that did not exist.
 *
 * Plugin pages had no way to move the user anywhere. Hub's list pages had been written against
 * `this.router?.push(...)`, and `router` is not a member of PluginComponent: the optional chain made
 * every Edit, Add and Open button a SILENT no-op. Nothing threw, nothing logged, the buttons simply did
 * nothing — which is the worst shape a bug can take, and exactly what `?.` on a non-existent contract
 * buys you.
 *
 * The host supplies `navigate`, because only the host knows its router and its base path (the admin
 * prefixes admin routes; a storefront does not). When no host wired one — a server render, or a host
 * that has not been updated — this falls back to a real browser navigation rather than doing nothing.
 * A slower navigation is a bug report; a dead button is a mystery.
 */
export class PluginNavigation {
  private readonly navigate?: (path: string, options?: { replace?: boolean }) => void;

  constructor(navigate?: (path: string, options?: { replace?: boolean }) => void) {
    this.navigate = navigate;
  }

  /** Go to `path`, adding a history entry. */
  push(path: string): void {
    this.go(path, false);
  }

  /** Go to `path`, replacing the current history entry. */
  replace(path: string): void {
    this.go(path, true);
  }

  private go(path: string, replace: boolean): void {
    const target = String(path ?? '');
    if (!target) return;
    if (this.navigate) {
      this.navigate(target, { replace });
      return;
    }
    // No host router: a full page load is slower, but it MOVES. Silence is not an option here.
    if (!Platform.hasWindow) return;
    if (replace) window.location.replace(target);
    else window.location.assign(target);
  }
}
