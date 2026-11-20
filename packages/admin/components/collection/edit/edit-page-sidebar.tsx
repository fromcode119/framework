import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { PermalinkInput } from '@/components/ui/view/permalink-input.client';
import { FieldRenderer } from '@/components/collection/view/field-renderer.client';
import { RecordSectionCard } from '@/components/collection/edit/view/record-section-card.client';
import { RecordPartPlace } from '@/components/collection/edit/enums/record-part-place.enum';
import { CollectionRecordPart } from '@/components/collection/edit/view/collection-record-part.client';
import type { CollectionRecordLinksDeclaration } from '@/components/collection/edit/collection-record-links-declaration';
import { PageDesignCard } from '@/components/collection/edit/view/page-design-card.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class EditPageSidebar extends PureReactor {
  @prop declare slug: string;
  @prop declare id: string;
  @prop declare isNew: boolean;
  @prop declare theme: ThemeMode;
  @prop declare collection: any;
  @prop declare resolvedSlug: string;
  @prop declare formData: Record<string, any>;
  @prop declare setFormData: (data: any) => void;
  @prop declare handleSubmit: any;
  @prop declare saving: boolean;
  @prop declare pluginSettings: Record<string, any>;
  @prop declare pluginSettingsSchema: Record<string, any>;
  @prop declare fieldErrors: Record<string, any>;
  @prop declare handleInputChange: (name: string, value: any) => void;
  @prop declare handlePatch: (partial: Record<string, any>) => void;
  @prop declare handleReadOnlyOverrideRequest: (target: { name: string; label: string }) => void;
  /** Record-scoped: one confirmation unlocks every overrideable read-only field on this record. */
  @prop declare readOnlyOverrideGranted: boolean;
  @prop declare showPermalink: boolean;
  @prop declare hasDisablePermalink: boolean;
  @prop declare hasSidebarFields: boolean;
  @prop declare sidebarFieldSections: Array<{ title: string; fields: any[] }>;
  @prop declare hasBuiltInSidebarContent: boolean;
  @prop declare saveError?: string;
  @prop declare clearSaveError?: () => void;
  @prop declare recordTitle?: string;
  /** Records other plugins hold about this one; a part mapped to a side section is drawn in its card. */
  @prop declare recordLinks?: CollectionRecordLinksDeclaration | null;
  @prop declare navigate?: (href: string) => void;
  /** Every section the page draws from fields, main and side: a part mapped to none of them gets its own card. */
  @prop declare fieldSectionKeys?: string[];
  /** Names each section's slots (`<base>.<section>.head|body|menu`); see RecordSectionCard. */
  @prop declare sectionSlotBase?: string;
  @prop declare slotProps?: Record<string, any>;

  @bound private renderField(field: any): ReactNode {
    const { theme, resolvedSlug, formData, saving, pluginSettings, pluginSettingsSchema, fieldErrors, handleInputChange, handlePatch, handleReadOnlyOverrideRequest, readOnlyOverrideGranted, isNew } = this;
    return (
      <FieldRenderer
        key={field.name}
        field={field}
        value={formData[field.name]}
        onChange={(val) => handleInputChange(field.name, val)}
        record={formData}
        onPatch={handlePatch}
        theme={theme}
        collectionSlug={resolvedSlug}
        pluginSettings={pluginSettings}
        pluginSettingsSchema={pluginSettingsSchema}
        disabled={saving}
        isNew={isNew}
        errors={fieldErrors[field.name]}
        readOnlyOverrideGranted={readOnlyOverrideGranted}
        onReadOnlyOverrideRequest={handleReadOnlyOverrideRequest}
      />
    );
  }

  /** One side section: a form card on a new record, a read card with its sheet on a saved one. */
  private renderSection(section: { title: string; fields: any[] }): ReactNode {
    if (this.isNew) {
      return (
        <RecordCard key={`sidebar-section-${section.title}`} title={section.title}>
          {/* The same field grid as the main column, so a side card opens and closes with the same room
              as a main one. It was a bare stack, and its first label stood 4px under the head's line. */}
          <div className="fc-edit-fields"><div className="fc-edit-fields__grid">{section.fields.map(this.renderField)}</div></div>
        </RecordCard>
      );
    }
    return (
      <RecordSectionCard
        key={`sidebar-section-${section.title}`}
        section={{ key: `sidebar-${section.title}`, title: section.title, fields: section.fields }}
        formData={this.formData}
        renderField={this.renderField}
        handlePatch={this.handlePatch}
        handleSubmit={() => this.handleSubmit()}
        saving={this.saving}
        saveError={this.saveError}
        clearSaveError={this.clearSaveError}
        recordTitle={this.recordTitle}
        slotBase={this.sectionSlotBase}
        slotProps={this.slotProps}
        recordPart={this.recordLinks ? (place: RecordPartPlace) => <CollectionRecordPart links={this.recordLinks!} sectionKey={section.title} navigate={this.navigate} place={place} /> : undefined}
      />
    );
  }

  /** A section only another plugin's records fill (an order's invoices): a card of its own. */
  private renderPartSection(section: { title: string; key: string }): ReactNode {
    return (
      <RecordSectionCard
        key={`part-section-${section.title}`}
        section={{ key: `part-${section.title}`, title: section.title, fields: [], slotKey: section.key }}
        slotBase={this.sectionSlotBase}
        slotProps={this.slotProps}
        formData={this.formData}
        renderField={this.renderField}
        handlePatch={this.handlePatch}
        handleSubmit={() => this.handleSubmit()}
        saving={this.saving}
        recordPart={(place: RecordPartPlace) => <CollectionRecordPart links={this.recordLinks!} sectionKey={section.title} navigate={this.navigate} place={place} standalone />}
      />
    );
  }

  /** The record's side sections, each part-only card right after the section it declares `after`. */
  private renderSections(): ReactNode[] {
    const sections = this.hasSidebarFields ? this.sidebarFieldSections : [];
    const partSections = !this.isNew && this.recordLinks ? this.recordLinks.sectionsWithoutFields(this.fieldSectionKeys || []) : [];
    const placed = new Set<string>();
    const out: ReactNode[] = [];
    for (const section of sections) {
      out.push(this.renderSection(section));
      const key = String(section.fields.find((field: any) => field?.admin?.sectionKey)?.admin?.sectionKey || '');
      for (const part of partSections) {
        if (key && part.after === key) { out.push(this.renderPartSection(part)); placed.add(part.title); }
      }
    }
    for (const part of partSections) if (!placed.has(part.title)) out.push(this.renderPartSection(part));
    return out;
  }

  render(): ReactNode {
    const {
      slug, id, isNew, collection, resolvedSlug, formData, setFormData, handleSubmit, saving,
      pluginSettings, pluginSettingsSchema, fieldErrors, handleInputChange, handlePatch, handleReadOnlyOverrideRequest,
      readOnlyOverrideGranted, showPermalink, hasDisablePermalink, hasSidebarFields, sidebarFieldSections,
      hasBuiltInSidebarContent,
    } = this;
    return (
      <div className="fc-edit-column">
        {/* The record's own settings first — status and publishing lead, as in shop and content admins —
            then what plugins add beside it, then the address, history and versions. */}
        {this.renderSections()}

        <Slot name={`admin.collection.${slug}.edit.sidebar`} props={{ formData, setFormData, isNew, handleSubmit, saving }} />
        <Slot name="admin.collection.edit.sidebar" props={{ formData, setFormData, isNew, handleSubmit, saving }} />

        {showPermalink && (
          <RecordCard title={AdminI18n.t('collection.edit.permalinkCard')}>
            <PermalinkInput
              value={formData.customPermalink}
              onChange={(val) => handleInputChange('customPermalink', val)}
              disabled={saving}
              id={isNew ? undefined : id}
              slug={formData.slug}
              collection={collection}
              pluginSettings={pluginSettings}
            />
            {hasDisablePermalink && (
              <div className="fc-permalink-card__row">
                <Switch
                  checked={Boolean(formData.disablePermalink)}
                  disabled={saving}
                  label={AdminI18n.t('ui.permalink.disable')}
                  onChange={(next: boolean) => handleInputChange('disablePermalink', next)}
                />
              </div>
            )}
            <p className="fc-permalink-card__hint">
              {AdminI18n.t('collection.edit.permalinkHint')}
            </p>
          </RecordCard>
        )}

        {/* Only the storefront pages collection can show a plugin's design; asking for any other record
            needs content access a plugin-only role does not hold, and the answer is always "none". */}
        {!isNew && collection?.storefrontPages === true && (
          <PageDesignCard collectionSlug={collection?.slug} recordId={id} content={formData.content} />
        )}

        {/* A card whose whole content is "this record has no side fields" is the empty sentence the
            record pages were cleared of: it takes a card's room to say that nothing is there. The
            column simply ends. */}
      </div>
    );
  }
}
