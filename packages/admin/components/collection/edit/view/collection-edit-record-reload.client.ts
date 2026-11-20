import { AdminConstants } from '@/lib/constants/admin.constants';
import { CollectionEditPageHandlers } from '@/components/collection/edit/view/collection-edit-page-handlers.client';
import { CollectionEditDirtyState } from '@/components/collection/edit/view/collection-edit-dirty-state.client';

/**
 * Reads a saved record again after something other than the page's own Save wrote it.
 *
 * Some fields apply a change through an action of their own, and the server then moves other values of
 * the record with it. The page only re-read the record after its own Save, so after such an action the
 * cards kept showing what the record held before, until the page was loaded again.
 *
 * A value the operator has edited and not saved stays as typed: only a value that still matches the
 * record as last loaded takes the server's new one. Returns what changed on screen.
 */
export class CollectionEditRecordReload {
  static async reload(self: any): Promise<Record<string, any>> {
    const { collection, resolvedSlug, isNew } = CollectionEditPageHandlers.context(self);
    const id = self.state.formData?.id;
    if (isNew || !id) return {};
    const url = `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/${id}?locale_mode=raw`;
    const saved = await CollectionEditPageHandlers.reloadSaved(collection, url);
    if (!saved) return {};
    const changed: Record<string, any> = {};
    await new Promise<void>((resolve) => self.setState((prev: any) => {
      const pristine = prev.pristineFormData || {};
      const formData = { ...prev.formData };
      for (const [name, value] of Object.entries(saved)) {
        const untouched = CollectionEditDirtyState.equal(prev.formData?.[name], pristine[name]);
        if (untouched && !CollectionEditDirtyState.equal(value, prev.formData?.[name])) {
          formData[name] = value;
          changed[name] = value;
        }
      }
      return { formData, pristineFormData: saved, recordReads: (prev.recordReads || 0) + 1 };
    }, resolve));
    return changed;
  }
}
