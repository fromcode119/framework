import type { ReactNode } from 'react';
import { PureReactor, prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminLink } from '@/components/view/admin-link.client';
import { AdminServices } from '@/lib/admin-services';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Where a record sits: a back button to its list, then list › record (› section, when one section is
 * opened on its own page). It stands above both columns, so the header card can share the first row
 * with the side column. The look is `admin.css` (`fc-record-crumbs*`).
 */
export class EditRecordCrumbs extends PureReactor {
  @prop declare pluginSlug: string;
  @prop declare slug: string;
  @prop declare id: string;
  @prop declare listLabel: string;
  @prop declare title: string;
  /** The section opened on its own page; null on the record itself. */
  @prop declare focusedSection: { key: string; title: string } | null;

  /** Where this tab last showed the list (its page); read after mount, so server and client render alike. */
  @state listHref = '';

  componentDidMount(): void {
    this.listHref = AdminServices.getInstance().uiPreference.readCollectionListHref(this.pluginSlug, this.slug);
  }

  render(): ReactNode {
    const crumbs = AdminClass.of('record-crumbs');
    const listHref = this.listHref || `/${this.pluginSlug}/${this.slug}`;
    const section = this.focusedSection;
    const recordHref = `/${this.pluginSlug}/${this.slug}/${this.id}`;
    return (
      <nav className={crumbs} aria-label={AdminI18n.t('collection.edit.breadcrumb')}>
        <AdminLink href={section ? recordHref : listHref} className={`${crumbs}__back`} aria-label={AdminI18n.t('common.back')} title={AdminI18n.t('common.back')}>
          <FrameworkIcons.Left size={16} />
        </AdminLink>
        <AdminLink href={listHref} className={`${crumbs}__link`}>{this.listLabel}</AdminLink>
        <span className={`${crumbs}__sep`} aria-hidden="true">›</span>
        {section ? (
          <>
            <AdminLink href={recordHref} className={`${crumbs}__link`}>{this.title}</AdminLink>
            <span className={`${crumbs}__sep`} aria-hidden="true">›</span>
            <span className={`${crumbs}__current`} aria-current="page">{section.title}</span>
          </>
        ) : (
          <span className={`${crumbs}__current`} aria-current="page">{this.title}</span>
        )}
      </nav>
    );
  }
}
