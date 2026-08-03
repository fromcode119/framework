import type { ReactElement, ReactNode } from 'react';
import { Reactor, prop, watch } from '@fromcode119/reactor';
import { AdminRuntimeContext } from '@/components/view/admin-runtime-context.client';
import { AdminFieldComponentBootstrapService } from '@/app/services/admin-field-component-bootstrap-service';
import type { IAdminRuntimeValue } from '@/components/interfaces/admin-runtime-value.interface';

/**
 * Hook-free class body of {@link AdminRuntimeProvider}. The thin functional shim reads every
 * context-backed hook ONCE and passes the resolved values in as props; this class republishes
 * them through {@link AdminRuntimeContext} so all other admin components can be hook-free classes.
 *
 * The field-component bootstrap effect is `componentDidMount` plus an `@watch('plugins')` — the decorator
 * replaces the hand-written `componentDidUpdate` + prevProps comparison.
 */
export class AdminRuntimeProviderView extends Reactor {
  @prop declare children: ReactNode;
  @prop declare theme: IAdminRuntimeValue['theme'];
  @prop declare toggleTheme: IAdminRuntimeValue['toggleTheme'];
  @prop declare notify: IAdminRuntimeValue['notify'];
  @prop declare globalSettings: IAdminRuntimeValue['globalSettings'];
  @prop declare plugins: IAdminRuntimeValue['plugins'];
  @prop declare collections: IAdminRuntimeValue['collections'];
  @prop declare router: IAdminRuntimeValue['router'];
  @prop declare pathname: IAdminRuntimeValue['pathname'];
  @prop declare params: IAdminRuntimeValue['params'];
  @prop declare auth: IAdminRuntimeValue['auth'];
  @prop declare activeAppearanceId: IAdminRuntimeValue['activeAppearanceId'];

  /** Typed to match `AdminFieldComponentBootstrapService.register`, which is the only consumer. */
  private get registerFieldComponent(): ((name: string, component: unknown) => void) | undefined {
    return (this.plugins as { registerFieldComponent?: (name: string, component: unknown) => void } | undefined)
      ?.registerFieldComponent;
  }

  componentDidMount(): void {
    AdminFieldComponentBootstrapService.register(this.registerFieldComponent);
  }

  @watch('plugins')
  protected onPluginsChanged(): void {
    AdminFieldComponentBootstrapService.register(this.registerFieldComponent);
  }

  /** The republished runtime value — one object so every consumer reads a single context. */
  private get value(): IAdminRuntimeValue {
    const { theme, toggleTheme, notify, globalSettings, plugins, collections, router, pathname, params, auth, activeAppearanceId } = this;
    return { theme, toggleTheme, notify, globalSettings, plugins, collections, router, pathname, params, auth, activeAppearanceId };
  }

  render(): ReactElement {
    return <AdminRuntimeContext.context.Provider value={this.value}>{this.children}</AdminRuntimeContext.context.Provider>;
  }
}
