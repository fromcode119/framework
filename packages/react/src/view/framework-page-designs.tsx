import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/react-class-components';
import { CoreServices, FrameworkPageRecipe, LayoutTargetKind } from '@fromcode119/core/client';
import { AuthShell } from '@react/auth/auth-shell';
import { AuthMode } from '@react/auth/enums/auth-mode.enum';
import { AccountShell } from '@react/account-shell';

/** A sign-in surface as a page design: the page's recipe names the surface. */
class AuthPageDesign extends Reactor {
  @prop declare entry?: Record<string, unknown> | null;

  render(): ReactNode {
    const mode = AuthMode.fromRecipe(this.entry?.recipe) ?? AuthMode.LOGIN;
    return <AuthShell mode={mode} documentLocale={String(this.entry?.locale || '') || undefined} />;
  }
}

/** The account as a page design. */
class AccountPageDesign extends Reactor {
  @prop declare entry?: Record<string, unknown> | null;

  render(): ReactNode {
    return <AccountShell page={this.entry} />;
  }
}

/**
 * The framework's own page designs: the sign-in surfaces (`auth.*`) and the account (`account.shell`).
 *
 * A site page carrying one of these recipes renders the framework surface INSIDE the theme's layout,
 * like any other page — header, footer and styles are the theme's, the flow is the framework's. A
 * theme never has to know these pages exist for them to work; one that wants a different look
 * restyles the `fc-auth*` / `fc-acct-*` classes, or replaces a recipe with `registerThemeOverrides`.
 *
 * Registered when this module is evaluated, on the server render and in the browser alike, so a page
 * paints the same surface on both sides. Re-registering (a hot reload) replaces the previous entry.
 */
export class FrameworkPageDesigns {
  static readonly NAMESPACE = 'system';
  static readonly AUTH_OWNER = 'auth';
  static readonly ACCOUNT_OWNER = 'account';

  static register(): void {
    const bridge = CoreServices.getInstance().defaultDesignRuntimeBridge;
    bridge.unregisterByPlugin(FrameworkPageDesigns.NAMESPACE, FrameworkPageDesigns.AUTH_OWNER);
    bridge.registerPluginDefaults({
      namespace: FrameworkPageDesigns.NAMESPACE,
      pluginSlug: FrameworkPageDesigns.AUTH_OWNER,
      layouts: AuthMode.all().map((mode) => ({
        namespace: FrameworkPageDesigns.NAMESPACE, pluginSlug: FrameworkPageDesigns.AUTH_OWNER,
        targetKind: LayoutTargetKind.PAGE, targetKey: mode.recipe, component: AuthPageDesign,
      })),
    });
    bridge.unregisterByPlugin(FrameworkPageDesigns.NAMESPACE, FrameworkPageDesigns.ACCOUNT_OWNER);
    bridge.registerPluginDefaults({
      namespace: FrameworkPageDesigns.NAMESPACE,
      pluginSlug: FrameworkPageDesigns.ACCOUNT_OWNER,
      layouts: [{
        namespace: FrameworkPageDesigns.NAMESPACE, pluginSlug: FrameworkPageDesigns.ACCOUNT_OWNER,
        targetKind: LayoutTargetKind.PAGE, targetKey: FrameworkPageRecipe.ACCOUNT, component: AccountPageDesign,
      }],
    });
  }

  static {
    FrameworkPageDesigns.register();
  }
}
