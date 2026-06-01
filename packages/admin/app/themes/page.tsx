import React from 'react';
import { redirect } from 'next/navigation';
import { AdminConstants } from '@/lib/constants';

export default class ThemesPage extends React.Component<{}> {
  render(): React.ReactNode {
  redirect(AdminConstants.ROUTES.THEMES.INSTALLED);
  }
}
