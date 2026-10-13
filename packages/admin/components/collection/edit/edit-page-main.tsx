import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Card } from '@/components/ui/view/card.client';
import { FieldRenderer } from '@/components/collection/view/field-renderer.client';

export class EditPageMain extends PureReactor {
  @prop declare standardMainFieldSections: Array<{ key: string; title?: string; fields: any[]; collapsed?: boolean }>;
  @prop declare fullWidthMainFieldSections: Array<{ key: string; title?: string; fields: any[]; collapsed?: boolean }>;
  @prop declare theme: ThemeMode;
  @prop declare resolvedSlug: string;
  @prop declare formData: Record<string, any>;
  @prop declare pluginSettings: Record<string, any>;
  @prop declare pluginSettingsSchema: Record<string, any>;
  @prop declare fieldErrors: Record<string, any>;
  @prop declare saving: boolean;
  @prop declare isNew: boolean;
  @prop declare slugWarning?: string | null;
  @prop declare slugManuallyEdited?: boolean;
  /** Record-scoped: one confirmation unlocks every overrideable read-only field on this record. */
  @prop declare readOnlyOverrideGranted: boolean;
  @prop declare handleInputChange: (name: string, value: any) => void;
  @prop declare handlePatch: (partial: Record<string, any>) => void;
  @prop declare handleReadOnlyOverrideRequest: (target: { name: string; label: string }) => void;

  /** Collapsed sections (`admin.sectionCollapsed`) the operator has opened on this page. */
  @state openSections: Record<string, boolean> = {};

  @bound renderField(field: any): ReactNode {
    return (
      <FieldRenderer
        key={field.name}
        field={field}
        value={this.formData[field.name]}
        onChange={(val) => this.handleInputChange(field.name, val)}
        record={this.formData}
        onPatch={this.handlePatch}
        theme={this.theme}
        collectionSlug={this.resolvedSlug}
        pluginSettings={this.pluginSettings}
        pluginSettingsSchema={this.pluginSettingsSchema}
        disabled={this.saving}
        isNew={this.isNew}
        errors={this.fieldErrors[field.name]}
        slugWarning={field.name === 'slug' ? this.slugWarning : undefined}
        slugManuallyEdited={field.name === 'slug' ? this.slugManuallyEdited : undefined}
        readOnlyOverrideGranted={this.readOnlyOverrideGranted}
        onReadOnlyOverrideRequest={this.handleReadOnlyOverrideRequest}
      />
    );
  }

  /**
   * The field grid.
   *
   * `gap-y-10` put 40px between every field on every collection edit screen, which is roughly the
   * height of a control — so a section of eight fields spent a field's worth of space four times over.
   * 24px still separates them clearly once each field carries its own label and description.
   */
  /**
   * A section as a card with a plain title, the way shop and content admins head their cards
   * ("Pricing", "Shipping"). The title is a size above the field labels, so the two never compete; it
   * replaced a 9px capitalised caption with a rule, which read as a divider rather than a heading.
   */
  private renderSection(section: { key: string; title?: string; fields: any[]; collapsed?: boolean }, prefix = ''): ReactNode {
    const collapsible = Boolean(section.title) && section.collapsed === true;
    // A field with an error must be seen, so its section opens by itself.
    const hasError = section.fields.some((field: any) => Boolean(this.fieldErrors?.[field.name]));
    const open = !collapsible || hasError || this.openSections[section.key] === true;
    return (
      <Card key={`${prefix}${section.key}`} id={`section-${section.key}`}>
        {collapsible ? this.renderToggle(section, open) : section.title ? (
          <h2 className="mb-4 text-[14px] font-semibold tracking-tight text-[var(--card-foreground)]">{section.title}</h2>
        ) : null}
        {open ? (
          /* Two fields side by side only when the CARD is wide enough for two — see .fc-edit-fields. */
          <div className="fc-edit-fields">
            <div className="fc-edit-fields__grid">
              {section.fields.map(this.renderField)}
            </div>
          </div>
        ) : null}
      </Card>
    );
  }

  /**
   * The title row of a collapsible section: the title, how many fields it holds, and Show / Hide, all
   * one button. Collapsed, the row still says what is inside, so nothing is out of sight unannounced.
   */
  private renderToggle(section: { key: string; title?: string; fields: any[] }, open: boolean): ReactNode {
    const Chevron = open ? FrameworkIcons.ChevronDown : FrameworkIcons.ChevronRight;
    return (
      <button
        type="button"
        aria-expanded={open}
        onClick={() => this.openSections = { ...this.openSections, [section.key]: !open }}
        className={`flex w-full items-center gap-2 text-left ${open ? 'mb-4' : ''}`}
      >
        <Chevron size={15} className="shrink-0 text-slate-400" />
        <h2 className="min-w-0 flex-1 text-[14px] font-semibold tracking-tight text-[var(--card-foreground)]">{section.title}</h2>
        <span className="shrink-0 text-[12px] text-slate-500">
          {AdminI18n.t('collection.edit.sectionFieldCount', { count: section.fields.length })}
          {' · '}
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            {AdminI18n.t(open ? 'collection.edit.sectionHide' : 'collection.edit.sectionShow')}
          </span>
        </span>
      </button>
    );
  }

  render(): ReactNode {
    return (
      <>
        {this.standardMainFieldSections.map((section) => this.renderSection(section))}
        {this.fullWidthMainFieldSections.map((section) => this.renderSection(section, 'full-width-'))}
      </>
    );
  }
}
