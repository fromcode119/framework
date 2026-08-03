import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/reactor';
import { Override } from '@react/view/override.client';
import { AccountShellSkeleton } from '@react/account/account-shell-skeleton';

/**
 * The account's loading shape, resolved through the override registry.
 *
 * Rendered wherever the real shell cannot be: the server (it is code-split and auth-gated), the window
 * before its chunk lands, and while the auth gate is still deciding. It resolves the SAME key as the
 * shell itself — a theme's replacement lives in the theme bundle, which is already loaded here, so it
 * stands in for its own loading state (rendering its chrome with no sections yet) and the layout never
 * jumps when the real shell takes over. Without a registered override this is the framework skeleton.
 */
export class AccountShellPlaceholder extends PureReactor {
  render(): ReactNode {
    return <Override name="account.shell" fallback={<AccountShellSkeleton />} />;
  }
}
