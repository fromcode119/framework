import React from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PromptDialog } from '@/components/ui/prompt-dialog';
import type { EditPageDialogsProps } from './edit-page-dialogs.interfaces';

export class EditPageDialogs extends React.Component<EditPageDialogsProps> {
  render(): React.ReactNode {
    const {
      readOnlyOverrideTarget, setReadOnlyOverrideTarget, openReadOnlyOverridePasswordPrompt,
      readOnlyOverridePasswordTarget, setReadOnlyOverridePasswordTarget, handleReadOnlyOverridePasswordConfirm,
      readOnlyOverrideVerifying, showDeleteConfirm, setShowDeleteConfirm, handleDelete, deleting
    } = this.props;
    return (
      <>
        <ConfirmDialog
          isOpen={Boolean(readOnlyOverrideTarget)}
          onClose={() => setReadOnlyOverrideTarget(null)}
          onConfirm={openReadOnlyOverridePasswordPrompt}
          title="Override Generated Value?"
          description={`"${readOnlyOverrideTarget?.label || 'This field'}" is read-only because it is generated automatically. Continue to unlock manual override?`}
          confirmLabel="Continue"
          cancelLabel="Cancel"
          variant="primary"
        />

        <PromptDialog
          isOpen={Boolean(readOnlyOverridePasswordTarget)}
          onClose={() => setReadOnlyOverridePasswordTarget(null)}
          onConfirm={handleReadOnlyOverridePasswordConfirm}
          isLoading={readOnlyOverrideVerifying}
          title="Confirm With Password"
          description={`Enter your account password to unlock "${readOnlyOverridePasswordTarget?.label || 'this field'}".`}
          placeholder="Current password"
          confirmLabel="Unlock Field"
          cancelLabel="Cancel"
          inputType="password"
        />

        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          isLoading={deleting}
          title="Delete Record"
          description="Are you sure you want to delete this record? This action is permanent and cannot be undone."
          confirmLabel="Delete Permanently"
        />
      </>
    );
  }
}
