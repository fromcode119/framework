import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminServices } from '@/lib/admin-services';
import { CollectionKeyUtils } from '@/components/collection/collection-key-utils';
import { CollectionListLayout } from '@/components/collection/list/collection-list-layout';
import { ListGroup } from '@/components/collection/list/list-group';

/**
 * The groups a list is divided into, in the order the group field itself declares: a select's options
 * as written, or the related collection's records in that collection's own list order (its
 * `admin.list.order`, so dragging the groups into order reorders the sections too).
 */
export class ListGroupSource {
  /** More than any list of groups an operator would arrange by hand; the API's page limit. */
  private static readonly LIMIT = 200;

  static async load(collection: any, layout: CollectionListLayout, collections: any[]): Promise<ListGroup[]> {
    const field = (collection?.fields || []).find((entry: any) => entry?.name === layout.groupField);
    if (!field) return [];
    const localization = AdminServices.getInstance().localization;
    if (field.type === 'select') {
      return (field.options || []).map((option: any) => {
        const value = String(option?.value ?? option ?? '');
        return new ListGroup(value, localization.resolveLabelText(option?.label ?? value) || value);
      });
    }

    const relatedSlug = CollectionKeyUtils.resolveSourceSlugs(field.relationTo, collections || [])[0];
    if (!relatedSlug) return [];
    const related = (collections || []).find((entry: any) => entry?.slug === relatedSlug);
    const relatedLayout = CollectionListLayout.from(related);
    const query = new URLSearchParams({ limit: String(ListGroupSource.LIMIT) });
    if (relatedLayout.orderField) query.set('sort', relatedLayout.orderField);
    const result = await AdminApi.get(`${AdminConstants.ENDPOINTS.COLLECTIONS.ITEM(relatedSlug)}?${query.toString()}`);
    return (result?.docs || []).map((doc: any) => new ListGroup(
      String(doc.id),
      (relatedLayout.titleField ? localization.resolveLabelText(doc[relatedLayout.titleField]) : '') || `#${doc.id}`,
    ));
  }
}
