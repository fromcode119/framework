"use client";

import React from 'react';
import { AdminConstants } from '@/lib/constants';
import { AdminComponent } from '@/components/admin-component';
import type { PluginSettingsRedirectPageProps } from './plugin-settings-redirect-page.interfaces';

export default class PluginSettingsRedirectPage extends AdminComponent<PluginSettingsRedirectPageProps> {
  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.props.params;
    if (!this.mounted) return;
    this.router.replace(AdminConstants.ROUTES.PLUGINS.SETTINGS_TAB(params.slug));
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  render(): React.ReactElement {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
}
