import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { EditPageMain } from '@/components/collection/edit/edit-page-main';
import { RecordDeclaredFields } from '@/components/collection/edit/record-declared-fields';
import { CollectionRecordLinksDeclaration } from '@/components/collection/edit/collection-record-links-declaration';
import { CollectionRecordLinksPanel } from '@/components/collection/edit/collection-record-links-panel.client';
import { EditStickyColumn } from '@/components/collection/edit/view/edit-sticky-column.client';
import { EditPageSidebar } from '@/components/collection/edit/edit-page-sidebar';
import { RecordJsonView } from '@/components/collection/edit/view/record-json-view.client';
import { RecordInfo } from '@/components/collection/record-info';
import { SidebarVersions } from '@/components/collection/edit/view/sidebar-versions.client';
import { CollectionEditRecordMore } from '@/components/collection/edit/view/collection-edit-record-more.client';
import { EditMoreSectionsCard } from '@/components/collection/edit/view/edit-more-sections-card.client';
import type { ICollectionEditPageViewModel } from '@/components/collection/edit/interfaces/collection-edit-page-view-model.interface';
import { Tabs } from '@/components/ui/view/tabs.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';

export class EditPageBody extends PureReactor {
  @prop declare edit: ICollectionEditPageViewModel;
  @prop declare slug: string;
  @prop declare id: string;
  /** The plugin the collection belongs to; with slug and id it names this record's own address. */
  @prop declare pluginSlug: string;
  /** Owned by the page view; switched from the header's record menu. */
  @prop declare advancedView: boolean;
  /** Where the record sits — the way back to its list; above both columns. Null on a new record. */
  @prop declare crumbs: ReactNode;
  /** The card naming the record; it heads the main column, so the side column starts level with it. */
  /** The record's header. A render function so the first section can pass its own "Edit" into the
      header's ⋯ when the header becomes that card's head. */
  @prop declare head: (opts?: { bare?: boolean; onEditDetails?: () => void }) => ReactNode;
  /** The record's title field — the first card's head shows it, so it is not also a row. */
  @prop declare titleFieldName?: string;

  render(): ReactNode {
    const { edit, slug, id } = this;
    const {
      status, setStatus, formData, setFormData, isNew, handleSubmit, saving, collection, theme,
      activeTab, setActiveTab, renderSidebar, resolvedSlug, pluginSettings, pluginSettingsSchema, fieldErrors,
      slugWarning, slugManuallyEdited, readOnlyOverrideGranted, handleInputChange, handlePatch,
      handleReadOnlyOverrideRequest, standardMainFieldSections, fullWidthMainFieldSections,
      showPermalink, hasDisablePermalink, hasSidebarFields, sidebarFieldSections, hasBuiltInSidebarContent,
      revisions, revisionsLoading, activeVersionId, setSelectedRevision, setActiveVersionId,
      loadMoreRevisions, hasMoreRevisions
    } = edit;

    // A new record can offer none of the correlation keys, so there is no question to ask yet.
    const recordLinks = isNew ? null : CollectionRecordLinksDeclaration.of(collection, formData, String(id));
    const navigate = (href: string) => edit.router?.push(href);
    /**
     * Opening a section only adds it to the address; the page must not move. `push` scrolls to the top
     * on navigation, so the operator pressed a row at the foot and landed back at the record's title.
     */
    const openSection = (href: string) => edit.router?.replace(href, { scroll: false });
    const history = !isNew && edit.openedSections.includes(CollectionEditRecordMore.HISTORY);
    const slotProps = { formData, setFormData, isNew, handleSubmit, saving };
    const sectionSlotBase = `admin.collection.${slug}.edit.section`;
    // Side sections are matched by title: that is the name a collection's `recordLinks.parts` gives them.
    const mainSectionKeys = [...standardMainFieldSections, ...fullWidthMainFieldSections].map((section: any) => String(section.key))
      .concat(renderSidebar ? sidebarFieldSections.map((section: any) => String(section.title)) : []);
    // A part mapped to a section no field names is drawn as a side card of its own, so it is placed too.
    if (recordLinks && renderSidebar) mainSectionKeys.push(...recordLinks.sectionsWithoutFields(mainSectionKeys).map((section) => section.title));

    const sideBySide = renderSidebar;
    const sidebar = renderSidebar ? (
      <EditPageSidebar
        slug={slug}
        id={id}
        isNew={isNew}
        theme={theme}
        collection={collection}
        resolvedSlug={resolvedSlug}
        formData={formData}
        setFormData={setFormData}
        handleSubmit={handleSubmit}
        saving={saving}
        pluginSettings={pluginSettings}
        pluginSettingsSchema={pluginSettingsSchema}
        fieldErrors={fieldErrors}
        handleInputChange={handleInputChange}
        handlePatch={handlePatch}
        handleReadOnlyOverrideRequest={handleReadOnlyOverrideRequest}
        readOnlyOverrideGranted={readOnlyOverrideGranted}
        showPermalink={showPermalink}
        hasDisablePermalink={hasDisablePermalink}
        hasSidebarFields={hasSidebarFields}
        sidebarFieldSections={sidebarFieldSections}
        hasBuiltInSidebarContent={hasBuiltInSidebarContent}
        saveError={status?.type === NotificationType.ERROR ? status.message : ''}
        recordTitle={edit.resolvedTitleValue}
        clearSaveError={() => setStatus(null)}
        recordLinks={recordLinks}
        navigate={navigate}
        sectionSlotBase={sectionSlotBase}
        slotProps={slotProps}
        fieldSectionKeys={[...standardMainFieldSections, ...fullWidthMainFieldSections].map((section: any) => String(section.key)).concat(sidebarFieldSections.map((section: any) => String(section.title)))}
      />
    ) : null;

    const renderedFieldNames = RecordDeclaredFields.of(collection);

    return (
    <div className="flex-1 w-full">
      {/*
        A real <form> element, purely so password inputs have a form ancestor: Chrome logs
        "[DOM] Password field is not contained in a form" for every one otherwise, and password
        managers misbehave. Saving is driven by the header/footer buttons, so submission is
        prevented here — Enter in a text field previously did nothing and still does nothing.
        <form> is block-level like the <div> it replaces, so layout is unaffected.
      */}
      <form onSubmit={(event) => event.preventDefault()}>
        {status && (
          <div className={`mb-8 p-4 rounded-xl flex items-start gap-4 border animate-in slide-in-from-top-2 ${status.type === NotificationType.SUCCESS ? 'fc-tone-success-soft fc-tone-success-line fc-tone-success' : 'fc-tone-danger-soft fc-tone-danger-line fc-tone-danger'}`}>
            <div className={`p-2 rounded-xl ${status.type === NotificationType.SUCCESS ? 'fc-tone-success-solid text-white shadow-lg shadow-emerald-500/20' : 'fc-tone-danger-solid text-white shadow-lg shadow-rose-500/20'}`}>
              {status.type === NotificationType.SUCCESS ? <FrameworkIcons.Check size={20} /> : <FrameworkIcons.Alert size={20} />}
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{AdminI18n.t(status.type === NotificationType.SUCCESS ? 'common.success' : 'common.error')}</p>
              <p className="text-sm opacity-90">{status.message}</p>
            </div>
            <Button type="button" variant={ButtonVariant.GHOST} size={FieldSize.ICON} aria-label={AdminI18n.t('common.close')} onClick={() => setStatus(null)}>
              <FrameworkIcons.Close size={16} />
            </Button>
          </div>
        )}



        {collection.admin?.tabs && collection.admin.tabs.length > 0 && (
          <Tabs className="mb-8" value={activeTab} onChange={setActiveTab}
            tabs={collection.admin.tabs.map((tab: any) => ({ id: tab.name, label: tab.label }))} />
        )}

        {this.crumbs}
        <div className="min-w-0">
        {this.advancedView ? (
          <div className="pb-32 space-y-6">
            {this.head()}
            <RecordJsonView formData={formData} setFormData={setFormData} collectionSlug={resolvedSlug || slug} renderedFieldNames={renderedFieldNames} />
          </div>
        ) : (
        <>
          {/* The columns follow the width the form actually has, not the window's: with the menu and a
              plugin's sub-menu open, a 1280px window leaves the form about 700px, and a sidebar taking a
              third of that squeezed every field into a sliver. Below the width a sidebar fits beside the
              form, it moves under it. */}
          <div className="fc-edit-columns">
          <div className={`fc-edit-columns__grid${sideBySide ? ' fc-edit-columns__grid--sidebar' : ''}`}>
          <div className="fc-edit-column">
            {/* A saved record's header is the head of its FIRST card (recordHeader), so there is no
                separate header card above it. A new record has no sections yet, so it keeps the header
                as its own card. */}
            {isNew ? this.head() : null}
            <EditPageMain
              recordHeader={isNew ? undefined : this.head}
              titleFieldName={this.titleFieldName}
              standardMainFieldSections={standardMainFieldSections}
              fullWidthMainFieldSections={fullWidthMainFieldSections}
              theme={theme}
              resolvedSlug={resolvedSlug}
              formData={formData}
              pluginSettings={pluginSettings}
              pluginSettingsSchema={pluginSettingsSchema}
              fieldErrors={fieldErrors}
              saving={saving}
              isNew={isNew}
              slugWarning={slugWarning}
              slugManuallyEdited={slugManuallyEdited}
              readOnlyOverrideGranted={readOnlyOverrideGranted}
              handleInputChange={handleInputChange}
              handlePatch={handlePatch}
              handleReadOnlyOverrideRequest={handleReadOnlyOverrideRequest}
              recordLinks={recordLinks}
              navigate={navigate}
              handleSubmit={() => handleSubmit()}
              saveError={status?.type === NotificationType.ERROR ? status.message : ''}
              recordTitle={edit.resolvedTitleValue}
              clearSaveError={() => setStatus(null)}
              sectionSlotBase={sectionSlotBase}
              slotProps={slotProps}
            />
            {/* What is linked to this record and has no section of its own on this page. */}
            {recordLinks && (
              <CollectionRecordLinksPanel links={recordLinks} placedTerms={recordLinks.placedTerms(mainSectionKeys)} theme={theme} navigate={navigate} />
            )}
            {/* A section opened from the foot is drawn HERE, where it was asked for, with the same
                renderer every other section uses — not at the place the collection declares for it. */}
            {!isNew && (edit.footSections || []).length > 0 && (
              <EditPageMain
                standardMainFieldSections={edit.footSections}
                fullWidthMainFieldSections={[]}
                theme={theme}
                resolvedSlug={resolvedSlug}
                formData={formData}
                pluginSettings={pluginSettings}
                pluginSettingsSchema={pluginSettingsSchema}
                fieldErrors={fieldErrors}
                saving={saving}
                isNew={isNew}
                slugWarning={slugWarning}
                slugManuallyEdited={slugManuallyEdited}
                readOnlyOverrideGranted={readOnlyOverrideGranted}
                handleInputChange={handleInputChange}
                handlePatch={handlePatch}
                handleReadOnlyOverrideRequest={handleReadOnlyOverrideRequest}
                recordLinks={null}
                navigate={navigate}
                handleSubmit={() => handleSubmit()}
                saveError={''}
                recordTitle={edit.resolvedTitleValue}
                clearSaveError={() => setStatus(null)}
                sectionSlotBase={sectionSlotBase}
                slotProps={slotProps}
              />
            )}
            {/* The record as it is stored is reached from the ⋯ menu's "Show as JSON", which swaps the
                whole page to the JSON view — a raw-JSON CARD under every record as well was the same
                thing twice, and a wall of keys the reference never shows on the record. */}
            {/* What else this record holds: one row per section the page does not draw, at its foot. */}
            {!isNew && (
              <EditMoreSectionsCard
                sections={edit.moreSections || []}
                openedSections={edit.openedSections || []}
                recordHref={`/${this.pluginSlug}/${slug}/${id}`}
                navigate={openSection}
              />
            )}
            {/* When the record was made and changed, and its versions: opened from the foot of the
                record like the held-back sections, under the record, which stays whole. */}
            {history && (
              <div id={CollectionEditRecordMore.anchorId(CollectionEditRecordMore.HISTORY)} className="space-y-4">
                {/* When the record was made and changed is in the side column on every saved record, so
                    this section is the versions alone. */}
                <SidebarVersions
                  revisions={revisions}
                  revisionsLoading={revisionsLoading}
                  activeVersionId={activeVersionId}
                  setSelectedRevision={setSelectedRevision}
                  setFormData={setFormData}
                  setActiveVersionId={setActiveVersionId}
                  loadMoreRevisions={loadMoreRevisions}
                  hasMoreRevisions={hasMoreRevisions}
                  formData={formData}
                  fields={collection?.fields ?? []}
                />
              </div>
            )}
            {/* What plugins add to this record. It stands in the MAIN column, under the record's own
                cards: in the side column a courier's waybill tool — a form with a delivery day, a
                payment mode and a packing-list table with a stepper per line — had 352px to live in,
                and every control in it was crushed. The consoles this one follows draw an app's blocks in the
                record's own column for the same reason. The side column keeps the record's short facts,
                so the customer and the state are still on the first screen. */}
            <div className="fc-edit-top"><div className="fc-edit-top__grid"><Slot name={`admin.collection.${slug}.edit.top`} props={{ formData, setFormData, isNew, handleSubmit, saving }} /></div></div>
          </div>

          {sideBySide && (
            <EditStickyColumn>
            {sidebar}
            {/* The record's own facts close the side column. Every console that lays a record out in two
                columns keeps one for the record itself (metadata and the raw record live there) — without
                it a record whose collection declares no side fields drew ONE card in a
                page three times its width, which is what this card ends. */}
            {!isNew && <RecordInfo id={id} createdAt={formData.createdAt} updatedAt={formData.updatedAt} />}
            </EditStickyColumn>
          )}
          </div>
          </div>
        </>
        )}
        </div>

        <Slot name={`admin.collection.${slug}.edit.bottom`} props={{ formData, setFormData, isNew, handleSubmit, saving }} />

      </form>
    </div>
    );
  }
}
