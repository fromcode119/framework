import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';

import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';

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
        title={deleteDialogState?.mode === 'bulk' ? `Delete ${deleteDialogState.ids.length} records` : 'Delete record'}
        description={
          deleteDialogState?.mode === 'bulk'
            ? `Are you sure you want to delete ${deleteDialogState.ids.length} selected records? This action is permanent and cannot be undone.`
            : 'Are you sure you want to delete this record? This action is permanent and cannot be undone.'
        }
        confirmLabel={deleteDialogState?.mode === 'bulk' ? 'Delete Records' : 'Delete Record'}
        cancelLabel="Cancel"
        variant={ButtonVariant.DANGER}
      />
    );
  }
}
