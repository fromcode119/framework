"use client";

import { BrowserLocalization } from '@fromcode119/react';
import { Field } from '@fromcode119/core/client';

import { AdminServices } from '@/lib/admin-services';
import { AdminCollectionUtils } from '@/lib/collection-utils';

/**
 * Pure, render-time derivations for the collection edit page (field sections, resolved title, status
 * field/options, preview flags), extracted from the former `useCollectionEditPage` useMemo blocks.
 * `self` is the `CollectionEditPageView` instance, typed loosely to avoid a circular import.
 */
export class CollectionEditDerivations {
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
    const sourceField = collection?.admin?.useAsTitle || (collection?.fields.find((f: Field) => f.name === 'name' || f.name === 'title')?.name);
    const sourceValue = sourceField ? services.localization.resolveLocalizedText(formData[sourceField], preferredLocale) : '';
    const resolvedTitleValue = (collection?.admin?.useAsTitle
      ? services.localization.resolveLocalizedText(formData[collection.admin.useAsTitle], preferredLocale)
      : '')
      || services.localization.resolveLocalizedText(formData.title, preferredLocale)
      || services.localization.resolveLocalizedText(formData.name, preferredLocale);

    const sidebarFields = (collection?.fields || []).filter((f: Field) =>
      f.admin?.position === 'sidebar' && !f.admin?.hidden && f.name !== 'customPermalink' &&
      services.validation.evaluateCondition(f.admin?.condition, formData, f.name));
    const sidebarFieldSections = CollectionEditDerivations.groupSidebar(sidebarFields);

    const mainFields = (collection?.fields || []).filter((field: Field) => {
      if (field.admin?.hidden || field.admin?.position === 'sidebar') return false;
      if (!services.validation.evaluateCondition(field.admin?.condition, formData, field.name)) return false;
      if (collection?.admin?.tabs && collection.admin.tabs.length > 0) {
        const fieldTab = field.admin?.tab || collection.admin.tabs[0].name;
        return fieldTab === self.state.activeTab;
      }
      return true;
    });
    const mainFieldSections = CollectionEditDerivations.groupMain(mainFields);
    const standardMainFieldSections = mainFieldSections.filter((s: any) => !s.fields.some((f: any) => f?.admin?.sectionLayout === 'full'));
    const fullWidthMainFieldSections = mainFieldSections.filter((s: any) => s.fields.some((f: any) => f?.admin?.sectionLayout === 'full'));
    const navSections = [...standardMainFieldSections, ...fullWidthMainFieldSections].map((s: any) => ({ key: s.key, title: s.title || 'Content' }));

    const statusField = collection?.fields.find((field: any) => field?.name === 'status' && field?.type === 'select') as any;
    const statusOptions = Array.isArray(statusField?.options)
      ? statusField.options.map((option: any) => ({ label: String(option?.label || option?.value || '').trim(), value: String(option?.value || '').trim() })).filter((option: any) => option.value)
      : [];

    const hasSlug = collection?.fields.some((f: Field) => f.name === 'slug');
    const canPreviewCollection = AdminCollectionUtils.supportsPreview(collection);
    const isFullWidth = (collection?.admin as any)?.fullWidth === true;
    const showPermalink = canPreviewCollection && hasSlug;
    const hasSidebarFields = sidebarFields.length > 0;

    return {
      collection, resolvedSlug, isNew, preferredLocale, sourceField, sourceValue, resolvedTitleValue,
      sidebarFieldSections, standardMainFieldSections, fullWidthMainFieldSections, navSections,
      statusOptions, currentStatusValue: String(formData?.status || '').trim(),
      currentRevIndex: self.state.selectedRevision ? self.state.revisions.findIndex((r: any) => r.id === self.state.selectedRevision.id) : -1,
      hasDisablePermalink: collection?.fields.some((f: any) => f.name === 'disablePermalink'),
      showPreview: canPreviewCollection && !isNew, showPermalink, isFullWidth,
      hideFooter: (collection?.admin as any)?.hideFooter === true,
      hasSidebarFields, renderSidebar: !isFullWidth,
      hasBuiltInSidebarContent: showPermalink || hasSidebarFields || !isNew
    };
  }

  private static groupSidebar(sidebarFields: any[]): Array<{ title: string; fields: any[] }> {
    const ordered: Array<{ title: string; fields: any[] }> = [];
    const indexByTitle = new Map<string, number>();
    sidebarFields.forEach((field: any) => {
      const title = String(field?.admin?.section || 'Settings').trim() || 'Settings';
      const existing = indexByTitle.get(title);
      if (existing === undefined) { indexByTitle.set(title, ordered.length); ordered.push({ title, fields: [field] }); return; }
      ordered[existing].fields.push(field);
    });
    return ordered;
  }

  private static groupMain(mainFields: any[]): Array<{ key: string; title?: string; fields: any[] }> {
    const ordered: Array<{ key: string; title?: string; fields: any[] }> = [];
    const indexByKey = new Map<string, number>();
    mainFields.forEach((field: any) => {
      const sectionTitle = typeof field?.admin?.section === 'string' ? field.admin.section.trim() : '';
      const key = sectionTitle || '__default__';
      const existing = indexByKey.get(key);
      if (existing === undefined) { indexByKey.set(key, ordered.length); ordered.push({ key, title: sectionTitle || undefined, fields: [field] }); return; }
      ordered[existing].fields.push(field);
    });
    return ordered;
  }
}
