"use client";

import React from 'react';
import { AdminComponent } from '@/components/admin-component';
import { AdminShellRegistry } from '@/lib/appearance/admin-shell-registry';
import ClientLayoutShell from './client-layout-shell';
import type { ClientLayoutChildrenProps } from './client-layout.interfaces';

/**
 * Renders the chrome for the active appearance: its registered shell if any, else the framework's
 * default ClientLayoutShell. The single place the host delegates the shell to the appearance system;
 * with no appearance shell registered this renders exactly today's ClientLayoutShell (zero change).
 */
export default class AppearanceShellHost extends AdminComponent<ClientLayoutChildrenProps> {
  render(): React.ReactNode {
    const Shell = AdminShellRegistry.shared.resolve(this.activeAppearanceId) ?? ClientLayoutShell;
    return <Shell>{this.props.children}</Shell>;
  }
}
