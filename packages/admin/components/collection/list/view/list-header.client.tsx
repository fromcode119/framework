import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { CollectionListUtils } from '@/components/collection/list/utils';

export class CollectionListHeader extends PureReactor {
  @prop declare collection: any;
  @prop declare pluginSlug: string;
  @prop declare slug: string;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const { collection, pluginSlug, slug, theme } = this;
  const displayName = CollectionListUtils.resolveCollectionLabel(collection, slug);
  const singularDisplayName = CollectionListUtils.resolveCollectionSingularLabel(collection, slug);

  return (
    <div className="sticky top-0 z-40 border-b backdrop-blur bg-white/90 border-slate-100 dark:bg-slate-950/80 dark:border-slate-800/60">
      <div className="w-full px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <Slot
            name={`admin.collection.${pluginSlug}.${slug}.header`}
            props={{ collection, pluginSlug, slug, theme }}
            fallback={
              <Slot
                name={`admin.collection.${slug}.header`}
                props={{ collection, pluginSlug, slug, theme }}
                fallback={
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-indigo-600 text-white dark:bg-indigo-500/10 dark:text-indigo-400 dark:border dark:border-indigo-500/20">
                      <FrameworkIcons.Layout size={18} />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-xl font-bold tracking-tight leading-tight text-slate-900 dark:text-white">
                        {collection.slug === 'users' ? 'User Management' : displayName}
                      </h1>
                      <p className="text-xs font-medium text-slate-500 tracking-tight truncate">
                        {collection.slug === 'users'
                          ? 'Manage system users, roles and security permissions.'
                          : CollectionListUtils.resolveCollectionDescription(collection, slug)}
                      </p>
                    </div>
                  </div>
                }
              />
            }
          />
        </div>

        <div className="flex items-center gap-2">
          <Slot name={`admin.collection.${slug}.header.actions`} props={{ collection }} />
          <Slot name="admin.collection.list.header.actions" props={{ collection }} />
          {collection.slug === 'users' && (
            <Button
              variant={ButtonVariant.SECONDARY}
              size={FieldSize.SM}
              className="h-9 px-4 rounded-lg font-semibold tracking-wide text-xs"
              icon={<FrameworkIcons.More size={15} />}
            >
              Invite
            </Button>
          )}
          {!collection.admin?.disableCreate && (
            <Button
              variant={ButtonVariant.PRIMARY}
              size={FieldSize.SM}
              as={Link}
              href={`/${pluginSlug}/${slug}/new`}
              className="h-9 px-4 rounded-lg font-semibold tracking-wide text-xs text-white"
              icon={<FrameworkIcons.Plus size={15} />}
            >
              {collection.slug === 'users' ? 'Create User' : `New ${singularDisplayName}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
  }
}
