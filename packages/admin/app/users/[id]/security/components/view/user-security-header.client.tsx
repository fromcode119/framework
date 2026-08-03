import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';

export class UserSecurityHeader extends PureReactor {
  @prop declare backHref: string;
  @prop declare email: string;
  @prop declare isDark: boolean;

  render(): ReactNode {
    return (
      <CompactPageHeader
        theme={this.isDark ? 'dark' : 'light'}
        backHref={this.backHref}
        title="Security & Two-Factor Authentication"
        subtitle={this.email}
      />
    );
  }
}
