import React from 'react';
import { redirect } from 'next/navigation';
import { AdminConstants } from '@/lib/constants';

export default class PluginsPage extends React.Component<{}> {
  render(): React.ReactNode {
  redirect(AdminConstants.ROUTES.PLUGINS.INSTALLED);
  }
}
