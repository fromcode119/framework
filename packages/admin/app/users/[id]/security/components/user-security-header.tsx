"use client";

import React from 'react';
import { CompactPageHeader } from '@/components/ui/compact-page-header';

export default class UserSecurityHeader extends React.Component<{ backHref: string; email: string; isDark: boolean }> {
  render(): React.ReactNode {
    const { email, isDark, backHref } = this.props;
    return (
      <CompactPageHeader
        theme={isDark ? 'dark' : 'light'}
        backHref={backHref}
        title="Security & Two-Factor Authentication"
        subtitle={email}
      />
    );
  }
}
