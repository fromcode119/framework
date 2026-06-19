"use client";

import React from 'react';
import { AdminRuntimeContext } from './admin-runtime-context';
import { AdminFieldComponentBootstrapService } from '@/app/services/admin-field-component-bootstrap-service';
import type { AdminRuntimeValue } from './admin-runtime-context.interfaces';
import type { AdminRuntimeProviderViewProps } from './admin-runtime-provider-view.interfaces';

/**
 * Hook-free class body of {@link AdminRuntimeProvider}. The thin functional shim reads every
 * context-backed hook ONCE and passes the resolved values in as props; this class republishes
 * them through {@link AdminRuntimeContext} so all other admin components can be hook-free classes.
 *
 * The field-component bootstrap effect lives here as componentDidMount + componentDidUpdate
 * (guarded on the `registerFieldComponent` reference) mirroring the original `React.useEffect`.
 */
export class AdminRuntimeProviderView extends React.Component<AdminRuntimeProviderViewProps> {
  private get registerFieldComponent(): any {
    return (this.props.plugins as any)?.registerFieldComponent;
  }

  componentDidMount(): void {
    AdminFieldComponentBootstrapService.register(this.registerFieldComponent);
  }

  componentDidUpdate(prevProps: AdminRuntimeProviderViewProps): void {
    const prevRegister = (prevProps.plugins as any)?.registerFieldComponent;
    if (prevRegister !== this.registerFieldComponent) {
      AdminFieldComponentBootstrapService.register(this.registerFieldComponent);
    }
  }

  render(): React.ReactElement {
    const { children, theme, toggleTheme, notify, globalSettings, plugins, collections, router, pathname, auth } = this.props;
    const value: AdminRuntimeValue = { theme, toggleTheme, notify, globalSettings, plugins, collections, router, pathname, auth };
    return <AdminRuntimeContext.context.Provider value={value}>{children}</AdminRuntimeContext.context.Provider>;
  }
}
