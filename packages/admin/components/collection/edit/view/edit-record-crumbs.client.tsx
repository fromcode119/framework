import type { ReactNode } from 'react';
import { PureReactor, prop, state } from '@fromcode119/react-class-components';
import { Crumbs } from '@/components/ui/view/crumbs.client';
import { AdminServices } from '@/lib/admin-services';

/**
 * Where a record sits: a back button to its list, then list › record. It stands above both columns, so
 * the header card can share the first row with the side column. Drawn by the kit's `Crumbs`.
 */
export class EditRecordCrumbs extends PureReactor {
  @prop declare pluginSlug: string;
  @prop declare slug: string;
  @prop declare listLabel: string;
  @prop declare title: string;

  /** Where this tab last showed the list (its page); read after mount, so server and client render alike. */
  @state listHref = '';

  componentDidMount(): void {
    this.listHref = AdminServices.getInstance().uiPreference.readCollectionListHref(this.pluginSlug, this.slug);
  }

  render(): ReactNode {
    return <Crumbs href={this.listHref || `/${this.pluginSlug}/${this.slug}`} listLabel={this.listLabel} title={this.title} />;
  }
}
