import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminLink } from '@/components/view/admin-link.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Where a page sits: a back button to the list it belongs to, then list › page. */
export class Crumbs extends PureReactor {
  /** The list this page belongs to. */
  @prop declare href: string;
  @prop declare listLabel: string;
  @prop declare title: ReactNode;

  render(): ReactNode {
    const crumbs = AdminClass.of('record-crumbs');
    return (
      <nav className={crumbs} aria-label={AdminI18n.t('collection.edit.breadcrumb')}>
        <AdminLink href={this.href} className={`${crumbs}__back`} aria-label={AdminI18n.t('common.back')} title={AdminI18n.t('common.back')}>
          <FrameworkIcons.Left size={16} />
        </AdminLink>
        <AdminLink href={this.href} className={`${crumbs}__link`}>{this.listLabel}</AdminLink>
        <span className={`${crumbs}__sep`} aria-hidden="true">›</span>
        <span className={`${crumbs}__current`} aria-current="page">{this.title}</span>
      </nav>
    );
  }
}
