import { FieldPosition } from '@fromcode119/core/client';
import { BrowserLocalization } from '@fromcode119/react';
import { IField } from '@fromcode119/core/client';

import { AdminServices } from '@/lib/admin-services';
import { AdminCollectionUtils } from '@/lib/collection-utils';
import { CollectionEditDirtyState } from '@/components/collection/edit/view/collection-edit-dirty-state.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { CollectionEditRecordMore } from '@/components/collection/edit/view/collection-edit-record-more.client';

/**
 * Pure, render-time derivations for the collection edit page (field sections, resolved title, status
 * field/options, preview flags), extracted from the former `useCollectionEditPage` useMemo blocks.
 * `self` is the `CollectionEditPageView` instance, typed loosely to avoid a circular import.
 */
export class CollectionEditDerivations {
  /** The form data with each top-level field the form does not hold yet given its schema `defaultValue`, as its control shows it. */
  static shown(fields: IField[], formData: Record<string, unknown> | null | undefined): Record<string, unknown> {
    const shown: Record<string, unknown> = { ...(formData || {}) };
    for (const field of fields) {
      if (!field.name || field.defaultValue === undefined) continue;
      const held = shown[field.name];
      if (held === undefined || held === null || held === '') shown[field.name] = field.defaultValue;
    }
    return shown;
  }

  static optionLabel(field: any, value: unknown): string {
    const wanted = String(value ?? '').trim();
    if (!wanted || !Array.isArray(field?.options)) return '';
    const option = field.options.find((candidate: any) => String(candidate?.value ?? '').trim() === wanted);
    return option ? String(option.label || option.value).trim() : wanted;
  }

  static build(self: any): any {
    const services = AdminServices.getInstance();
    const collection = AdminCollectionUtils.resolveCollection(self.props.collections, self.props.pluginSlug, self.props.slug);
    const resolvedSlug = collection?.slug || self.props.slug;
    const isNew = self.props.id === 'new';
    const formData = self.state.formData;

    const preferredLocaleFallback = services.localization.normalizeLocaleCode(
      BrowserLocalization.getPreferredBrowserLocale({
        fallback: self.props.settings?.default_locale || self.props.settings?.defaultLocale || self.props.settings?.system_default_locale || ''
      })
    );
    const preferredLocale = services.localization.normalizeLocaleCode(formData?.locale || preferredLocaleFallback);
    const sourceField = collection?.admin?.useAsTitle || (collection?.fields.find((f: IField) => f.name === 'name' || f.name === 'title')?.name);
    const sourceValue = sourceField ? services.localization.resolveLocalizedText(formData[sourceField], preferredLocale) : '';
    const resolvedTitleValue = (collection?.admin?.useAsTitle
      ? services.localization.resolveLocalizedText(formData[collection.admin.useAsTitle], preferredLocale)
      : '')
      || services.localization.resolveLocalizedText(formData.title, preferredLocale)
      || services.localization.resolveLocalizedText(formData.name, preferredLocale);

    /**
     * `admin.disableCreate` / `admin.disableEdit` say the operator cannot add or change rows here — an
     * event log, a consent record, a planned job the scheduler owns. Eleven collections declared it and
     * the admin READ only the first, to hide one button on the list: `/<plugin>/<slug>/new` still served
     * a full create form, and the edit form still saved. Marking every field read-only is what makes the
     * declaration true. The row stays VISIBLE — an operator must be able to see what the runtime wrote —
     * and the existing password-gated override remains the one deliberate way past it.
     */
    const locked = !isNew && (collection?.admin as any)?.disableEdit === true;
    const lockField = (field: any) => (locked ? { ...field, admin: { ...(field.admin || {}), readOnly: true } } : field);

    /**
     * A field whose control is rendered by a SIBLING field's component, so the standard renderer must
     * not draw it a second time.
     *
     * This is deliberately not `admin.hidden`. Hidden means "there is no control for this value",
     * which Rule Zero forbids: the value still ships and still drives behaviour with nothing the
     * operator can point at. `renderedBy` NAMES the field that owns the control, so the declaration
     * stays answerable — "what edits this?" has a written answer, and anyone reading the collection
     * can follow it.
     */
    const isRenderedBySibling = (field: IField) => Boolean((field.admin as any)?.renderedBy);

    /**
     * What each field's condition is judged against: the form as its controls SHOW it. A field the operator has
     * not touched shows its schema `defaultValue` (a select reads "On or off" on a new record) and the server saves
     * that value, so a field shown only while it holds that value must be shown too — judged on the raw form data
     * it stayed hidden until the operator picked the very option already displayed.
     */
    const shownData = CollectionEditDerivations.shown(collection?.fields || [], formData);

    const sidebarFields = (collection?.fields || []).filter((f: IField) =>
      FieldPosition.resolve(f.admin?.position) === FieldPosition.SIDEBAR && !f.admin?.hidden && !isRenderedBySibling(f) && f.name !== 'customPermalink' &&
      services.validation.evaluateCondition(f.admin?.condition, shownData, f.name));
    const sidebarGrouped = CollectionEditDerivations.groupSidebar(sidebarFields.map(lockField));

    const mainFields = (collection?.fields || []).filter((field: IField) => {
      if (field.admin?.hidden || isRenderedBySibling(field) || FieldPosition.resolve(field.admin?.position) === FieldPosition.SIDEBAR) return false;
      if (!services.validation.evaluateCondition(field.admin?.condition, shownData, field.name)) return false;
      if (collection?.admin?.tabs && collection.admin.tabs.length > 0) {
        const fieldTab = field.admin?.tab || collection.admin.tabs[0].name;
        return fieldTab === self.state.activeTab;
      }
      return true;
    });
    const mainFieldSections = CollectionEditDerivations.groupMain(mainFields.map(lockField));
    /**
     * Sections are grouped from EVERY eligible field first and narrowed after: a section's place and width
     * come from its fields, so narrowing first moved a section whenever the field that set its layout was
     * the one held back. What is held back is listed under "More" (see CollectionEditRecordMore).
     */
    const everySection = [...sidebarGrouped, ...mainFieldSections];
    const focusedSectionTitle = CollectionEditRecordMore.focusedTitle(everySection, CollectionEditRecordMore.focusKey(self.props.searchParams));
    const focus = focusedSectionTitle ? CollectionEditRecordMore.focusKey(self.props.searchParams) : '';
    const draw = <T extends { key: string; fields: any[] }>(sections: T[]): T[] => CollectionEditRecordMore.draw(sections, focus, formData, self.state.fieldErrors);
    const sidebarFieldSections = draw(sidebarGrouped);
    /**
     * The main column is one column of cards, so its sections come in the order the collection declares
     * them. Sections holding a `sectionLayout: 'full'` field used to be moved after all the others, from
     * when the column held two cards side by side; that put an order's items below its payment and shipment.
     */
    const standardMainFieldSections = draw(mainFieldSections);
    const fullWidthMainFieldSections: typeof standardMainFieldSections = [];
    const moreSections = focus ? [] : CollectionEditRecordMore.rows(everySection, formData, self.state.fieldErrors);

    const statusField = collection?.fields.find((field: any) => field?.name === 'status' && field?.type === 'select') as any;
    // A read-only status is changed by the collection's own actions (a refund moves through the service
    // that refunds it). The header select ignored that and offered every option, which the server then
    // refused with "Unlock confirmation is required" — so a read-only status, or a locked record, gets no
    // header control.
    const statusOptions = Array.isArray(statusField?.options) && statusField?.admin?.readOnly !== true && !locked
      ? statusField.options.map((option: any) => ({ label: String(option?.label || option?.value || '').trim(), value: String(option?.value || '').trim(), tone: String(option?.tone || '').trim() })).filter((option: any) => option.value)
      : [];

    const hasSlug = collection?.fields.some((f: IField) => f.name === 'slug');
    const canPreviewCollection = AdminCollectionUtils.supportsPreview(collection);
    const isFullWidth = (collection?.admin as any)?.fullWidth === true;
    const showPermalink = canPreviewCollection && hasSlug;
    const hasSidebarFields = sidebarFieldSections.length > 0;

    return {
      collection, resolvedSlug, isNew, locked, preferredLocale, sourceField, sourceValue, resolvedTitleValue,
      sidebarFieldSections, standardMainFieldSections, fullWidthMainFieldSections,
      moreSections, focusedSection: focus ? { key: focus, title: focusedSectionTitle } : null,
      // The status field shows its schema default until the operator picks one, and the default is what is
      // saved; the header showed the FIRST option instead (a new subscription read "Trial" above a field
      // reading "Pending"). Both now name the same value.
      statusOptions, currentStatusValue: String(formData?.status || statusField?.defaultValue || '').trim(),
      // Named in the header whether or not it may be changed there: a read-only status is still the
      // record's state. The option's label, never the raw value; nothing when the record has none.
      currentStatusLabel: CollectionEditDerivations.optionLabel(statusField, formData?.status || statusField?.defaultValue),
      currentRevIndex: self.state.selectedRevision ? self.state.revisions.findIndex((r: any) => r.id === self.state.selectedRevision.id) : -1,
      hasDisablePermalink: collection?.fields.some((f: any) => f.name === 'disablePermalink'),
      showPreview: canPreviewCollection && !isNew, showPermalink, isFullWidth,
      hideFooter: (collection?.admin as any)?.hideFooter === true,
      isDirty: CollectionEditDirtyState.isDirty(formData, self.state.pristineFormData, isNew),
      hasSidebarFields,
      /**
       * The sidebar takes a THIRD of the page, so it is rendered only when it has something to put
       * there. A collection with no sidebar fields, creating a new record, has no permalink, no record
       * info and no version history — and the column rendered anyway, holding the placeholder "No
       * sidebar fields are configured for this collection yet." So every create form in the admin was
       * half a page of fields beside a third of a page explaining a developer's concern to an operator.
       * Editing brings the column back, because record info and versions are real content.
       */
      renderSidebar: !isFullWidth && (showPermalink || hasSidebarFields || !isNew),
      hasBuiltInSidebarContent: showPermalink || hasSidebarFields || !isNew
    };
  }

  /** Keyed `side:<title>`, so a "More" link to a side section never names a main one of the same title. */
  private static groupSidebar(sidebarFields: any[]): Array<{ key: string; title: string; fields: any[] }> {
    const ordered: Array<{ key: string; title: string; fields: any[] }> = [];
    const indexByTitle = new Map<string, number>();
    sidebarFields.forEach((field: any) => {
      const title = String(field?.admin?.section || AdminI18n.t('collection.edit.settings')).trim() || AdminI18n.t('collection.edit.settings');
      const existing = indexByTitle.get(title);
      if (existing === undefined) { indexByTitle.set(title, ordered.length); ordered.push({ key: `side:${title}`, title, fields: [field] }); return; }
      ordered[existing].fields.push(field);
    });
    return ordered;
  }

  private static groupMain(mainFields: any[]): Array<{ key: string; title?: string; fields: any[]; collapsed: boolean }> {
    const ordered: Array<{ key: string; title?: string; fields: any[]; collapsed: boolean }> = [];
    const indexByKey = new Map<string, number>();
    mainFields.forEach((field: any) => {
      const sectionTitle = typeof field?.admin?.section === 'string' ? field.admin.section.trim() : '';
      const key = sectionTitle || '__default__';
      // Only a titled section can collapse: its title is what stays on screen to open it by.
      const collapses = Boolean(sectionTitle) && field?.admin?.sectionCollapsed === true;
      const existing = indexByKey.get(key);
      if (existing === undefined) { indexByKey.set(key, ordered.length); ordered.push({ key, title: sectionTitle || undefined, fields: [field], collapsed: collapses }); return; }
      ordered[existing].fields.push(field);
      if (collapses) ordered[existing].collapsed = true;
    });
    return ordered;
  }
}
