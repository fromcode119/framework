import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class CollectionListDeleteDialog extends PureReactor {
  @prop declare deleteDialogState: { mode: 'single'; id: string } | { mode: 'bulk'; ids: string[] } | null;
  @prop declare deleteLoading: boolean;
  @prop declare onClose: () => void;
  @prop declare onConfirm: () => void;

  render(): ReactNode {
    const { deleteDialogState, deleteLoading, onClose, onConfirm } = this;
    return (
      <ConfirmDialog
        isOpen={Boolean(deleteDialogState)}
        onClose={onClose}
        onConfirm={onConfirm}
        isLoading={deleteLoading}
        title={deleteDialogState?.mode === 'bulk' ? AdminI18n.t('collection.list.deleteManyTitle', { count: deleteDialogState.ids.length }) : AdminI18n.t('collection.list.deleteOneTitle')}
        description={
          deleteDialogState?.mode === 'bulk'
            ? AdminI18n.t('collection.list.deleteManyText', { count: deleteDialogState.ids.length })
            : AdminI18n.t('collection.list.deleteOneText')
        }
        confirmLabel={AdminI18n.t(deleteDialogState?.mode === 'bulk' ? 'collection.list.deleteManyConfirm' : 'collection.list.deleteOneConfirm')}
        cancelLabel={AdminI18n.t('common.cancel')}
        variant={ButtonVariant.DANGER}
      />
    );
  }
}
