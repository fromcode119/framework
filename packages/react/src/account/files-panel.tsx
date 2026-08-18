import type { ReactNode } from 'react';
import { PluginComponent } from '@react/view/plugin-component.client';
import { SlotsContext } from '@react/context/slots-context';
import { AccountFileSourceRegistry } from '@react/account/account-file-source-registry';
import { AccountFilesContent } from '@react/account/files-content';

/**
 * The account's single Files section.
 *
 * A thin reader of the `account.files.sources` slot, exactly as {@link AccountOverviewPanel} reads
 * `account.overview.stats` — the plugins contribute the files, this names none of them.
 */
export class AccountFilesPanel extends PluginComponent {
  static readonly accountSection = {
    key: 'files',
    labelKey: 'account.section.files',
    priority: 24,
    descriptionKey: 'account.description.files',
  };

  render(): ReactNode {
    return (
      <SlotsContext.Context.Consumer>
        {(slots) => <AccountFilesContent contributors={slots?.[AccountFileSourceRegistry.SLOT] || []} />}
      </SlotsContext.Context.Consumer>
    );
  }
}
