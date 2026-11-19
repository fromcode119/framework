import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ExportFormat } from '@/components/collection/list/enums/export-format.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, ReactNode } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { ListShellHead } from '@/components/ui/view/list-shell-head.client';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { CollectionListUtils } from '@/components/collection/list/utils';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A collection list's header. It renders the console's ONE page header (`CompactPageHeader`), like
 * every plugin page and every settings screen: this bar used to be hand-built — its own sticky wrapper,
 * its own `px-4 sm:px-6 lg:px-8 py-3 sm:py-4`, an indigo icon tile and a `text-xl` title — so moving
 * from the finance overview to the transactions list shifted the title's left edge by 8px, its size by
 * 4px and the space under it by 10px. Nothing is lost: the two header slots and the New button are
 * still here, as the header's title and actions.
 */
export class CollectionListHeader extends PureReactor {
  @prop declare collection: any;
  @prop declare pluginSlug: string;
  @prop declare slug: string;
  @prop declare theme: ThemeMode;
  /** "New" is offered only when the signed-in user may create these records. */
  @prop declare canCreate: boolean;
  /** Which plugin-contributed header actions to offer — see `CollectionAccess.allowsPluginAction`. */
  @prop declare includeAction: (contribution: { pluginSlug: string }) => boolean;
  /** Export the list, and (for a user who may create) import into it — the reference's header keeps
      these two quiet buttons beside Create, not in a footer band of their own. */
  @prop declare handleExport?: (format: ExportFormat) => void;
  @prop declare handleImport?: (event: ChangeEvent<HTMLInputElement>) => void;

  private get displayName(): string {
    return CollectionListUtils.resolveCollectionLabel(this.collection, this.slug);
  }

  /** The title, or whatever a plugin puts in this list's header slot instead. */
  private title(): ReactNode {
    const { collection, pluginSlug, slug, theme } = this;
    const plain = collection.slug === 'users' ? AdminI18n.t('collection.list.usersTitle') : this.displayName;
    return (
      <Slot
        name={`admin.collection.${pluginSlug}.${slug}.header`}
        props={{ collection, pluginSlug, slug, theme }}
        fallback={<Slot name={`admin.collection.${slug}.header`} props={{ collection, pluginSlug, slug, theme }} fallback={plain} />}
      />
    );
  }

  private actions(): ReactNode {
    const { collection, pluginSlug, slug } = this;
    const singular = CollectionListUtils.resolveCollectionSingularLabel(collection, slug);
    return (
      <>
        {this.handleExport ? (
          <Button variant={ButtonVariant.SECONDARY} size={FieldSize.SM} onClick={() => this.handleExport?.(ExportFormat.JSON)} icon={<FrameworkIcons.Download size={15} />}>
            {AdminI18n.t('collection.list.exportJson')}
          </Button>
        ) : null}
        {this.canCreate && this.handleImport ? (
          <label className="fc-btn cursor-pointer">
            <FrameworkIcons.Upload size={15} />
            {AdminI18n.t('collection.list.bulkImport')}
            <input type="file" className="hidden" accept=".json" onChange={this.handleImport} />
          </label>
        ) : null}
        <Slot name={`admin.collection.${slug}.header.actions`} include={this.includeAction} props={{ collection }} />
        <Slot name="admin.collection.list.header.actions" include={this.includeAction} props={{ collection }} />
        {this.canCreate && !collection.admin?.disableCreate && (
          <Button
            variant={ButtonVariant.PRIMARY}
            size={FieldSize.SM}
            as={AdminLink}
            href={`/${pluginSlug}/${slug}/new`}
            icon={<FrameworkIcons.Plus size={15} />}
          >
            {collection.slug === 'users' ? AdminI18n.t('collection.list.createUser') : AdminI18n.t('collection.list.newRecord', { name: singular, label: this.displayName })}
          </Button>
        )}
      </>
    );
  }

  render(): ReactNode {
    // No line under the title for a collection: "Manage and organize orders records." said the title
    // again in a sentence, on every list in the console. The users list is the one that explains itself.
    const subtitle = this.collection.slug === 'users' ? AdminI18n.t('collection.list.usersDescription') : undefined;
    return (
      /* The list's name and its actions are the CARD's head, the way the reference draws a list:
         one card holding the name and the buttons, then the tools, then the table, then the count.
         It used to be the console's page header above the card, which put the name of the screen and
         the name of the card one under the other with nothing between them. */
      <ListShellHead title={this.title()} subtitle={subtitle} actions={this.actions()} />
    );
  }
}
