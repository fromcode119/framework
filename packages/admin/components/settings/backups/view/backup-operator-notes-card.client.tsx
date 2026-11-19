import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { CodeBlock } from '@/components/ui/view/code-block.client';
import { Text } from '@/components/ui/view/text.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class BackupOperatorNotesCard extends AdminComponent {
  render(): ReactNode {
    return (
      <RecordCard title={AdminI18n.t('settings.components.operatorNotes')}>
        <div className="fc-stack">
          <Text muted>{AdminI18n.t('settings.components.createASystemSnapshotBefore')}</Text>
          <CodeBlock label={AdminI18n.t('settings.components.cliBundleCommand')} code="npm run fromcode -- system site-transfer-bundle --label demo-transfer" />
          <CodeBlock label={AdminI18n.t('settings.components.wrapperScript')} code="npm run bundle:site-transfer -- --label demo-transfer" />
          <Text size="xsmall" muted>{AdminI18n.t('settings.components.referenceDocumentation')}: docs/backup-and-transfer.md. {AdminI18n.t('settings.components.restoreExecutionAlwaysCreatesA')}</Text>
        </div>
      </RecordCard>
    );
  }
}
