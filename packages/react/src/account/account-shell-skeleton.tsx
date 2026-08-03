import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/reactor';
import { AccountClass } from '@react/account/account-class';

/**
 * The account page's shape, with none of its data.
 *
 * `AccountShell` is code-split (it and the auth/records shells are ~400 KB that must not sit in the
 * storefront's first chunk) and it is auth-gated, so neither the SERVER nor the client's first paint can
 * produce the real thing. Rendering nothing in the meantime is what made an account URL open to a page
 * with a navbar, a footer and a hole in the middle.
 *
 * This is what stands there instead: the same header, sidebar and card the real shell renders, at the
 * same sizes, with placeholder blocks instead of content. It is the `React.lazy` fallback, so it covers
 * the server render AND the window before the chunk arrives, and the layout does not move when the real
 * shell replaces it.
 */
export class AccountShellSkeleton extends PureReactor {
  /** Enough rows to fill a typical viewport without inventing a specific section's shape. */
  private static readonly NAV_ROWS = 8;

  private static readonly BODY_ROWS = 4;

  private static rows(count: number, className: string): ReactNode[] {
    return Array.from({ length: count }, (_, index) => <div key={index} className={className} />);
  }

  render(): ReactNode {
    return (
      <div className={AccountClass.ROOT} aria-busy="true" aria-live="polite">
        <header className={AccountClass.of('header')}>
          <div className={AccountClass.of('eyebrow')}>&nbsp;</div>
          <div className={AccountClass.of('skeleton-title')} />
        </header>
        <div className={AccountClass.of('body')}>
          <nav className={AccountClass.of('nav')} aria-hidden="true">
            {AccountShellSkeleton.rows(AccountShellSkeleton.NAV_ROWS, AccountClass.of('skeleton-navlink'))}
          </nav>
          <main className={AccountClass.of('main')}>
            <div className={AccountClass.of('card')}>
              {AccountShellSkeleton.rows(AccountShellSkeleton.BODY_ROWS, AccountClass.of('skeleton-line'))}
            </div>
          </main>
        </div>
      </div>
    );
  }
}
