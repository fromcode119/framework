import { NotificationType } from '@/components/enums/notification-type.enum';
import { FieldRenderer } from '@/components/collection/view/field-renderer.client';
import type { ICollectionEditPageViewModel } from '@/components/collection/edit/interfaces/collection-edit-page-view-model.interface';
import type { ICollectionEditController } from '@/lib/appearance/interfaces/collection-edit-controller.interface';

/**
 * Projects the edit page's view model onto the narrow {@link ICollectionEditController} an appearance's
 * record editor receives. Every field is still drawn by `FieldRenderer` with the same wiring as the
 * standard editor's main column, so a custom layout cannot drift from how a field behaves.
 */
export class CollectionEditControllerBuilder {
  static build(
    edit: ICollectionEditPageViewModel,
    route: { listHref: string; canSave: boolean; canDelete: boolean },
  ): ICollectionEditController {
    const status = edit.status;
    return {
      collection: edit.collection,
      title: edit.resolvedTitleValue,
      isNew: edit.isNew,
      listHref: route.listHref,
      sections: [...edit.standardMainFieldSections, ...edit.fullWidthMainFieldSections, ...edit.sidebarFieldSections.map((section) => ({ key: `sidebar-${section.title}`, title: section.title, fields: section.fields }))],
      renderField: (field) => (
        <FieldRenderer
          key={field.name}
          field={field as any}
          value={edit.formData[field.name]}
          onChange={(value) => edit.handleInputChange(field.name, value)}
          record={edit.formData}
          onPatch={edit.handlePatch}
          theme={edit.theme}
          collectionSlug={edit.resolvedSlug}
          pluginSettings={edit.pluginSettings}
          pluginSettingsSchema={edit.pluginSettingsSchema}
          disabled={edit.saving || !route.canSave}
          isNew={edit.isNew}
          errors={edit.fieldErrors[field.name]}
          slugWarning={field.name === 'slug' ? edit.slugWarning : undefined}
          slugManuallyEdited={field.name === 'slug' ? edit.slugManuallyEdited : undefined}
          readOnlyOverrideGranted={edit.readOnlyOverrideGranted}
          onReadOnlyOverrideRequest={edit.handleReadOnlyOverrideRequest}
        />
      ),
      save: () => { void edit.handleSubmit(undefined, edit.changeSummary); },
      requestDelete: () => edit.setShowDeleteConfirm(true),
      saving: edit.saving,
      isDirty: edit.isDirty,
      error: status?.type === NotificationType.ERROR ? status.message : '',
      notice: status?.type === NotificationType.SUCCESS ? status.message : '',
      canSave: route.canSave,
      canDelete: route.canDelete && !edit.isNew,
    };
  }
}
