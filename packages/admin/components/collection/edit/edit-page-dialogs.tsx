import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { PromptDialog } from '@/components/ui/view/prompt-dialog.client';
import type { IOverrideTarget } from '@/components/collection/edit/interfaces/override-target.interface';
export class EditPageDialogs extends PureReactor {
  @prop declare readOnlyOverrideTarget: IOverrideTarget | null;
  @prop declare setReadOnlyOverrideTarget: (target: IOverrideTarget | null) => void;
  @prop declare openReadOnlyOverridePasswordPrompt: () => void;
  @prop declare readOnlyOverridePasswordTarget: IOverrideTarget | null;
  @prop declare setReadOnlyOverridePasswordTarget: (target: IOverrideTarget | null) => void;
  @prop declare handleReadOnlyOverridePasswordConfirm: (password: string) => void;
  @prop declare readOnlyOverrideVerifying: boolean;
  @prop declare showDeleteConfirm: boolean;
  @prop declare setShowDeleteConfirm: (open: boolean) => void;
  @prop declare handleDelete: () => void;
  @prop declare deleting: boolean;

  render(): ReactNode {
    return (
      <>
        <ConfirmDialog
          isOpen={Boolean(this.readOnlyOverrideTarget)}
          onClose={() => this.setReadOnlyOverrideTarget(null)}
          onConfirm={this.openReadOnlyOverridePasswordPrompt}
          title="Override Generated Value?"
          description={`"${this.readOnlyOverrideTarget?.label || 'This field'}" is read-only because it is generated automatically. Continue to unlock manual override?`}
          confirmLabel="Continue"
          cancelLabel="Cancel"
          variant="primary"
        />

        <PromptDialog
          isOpen={Boolean(this.readOnlyOverridePasswordTarget)}
          onClose={() => this.setReadOnlyOverridePasswordTarget(null)}
          onConfirm={this.handleReadOnlyOverridePasswordConfirm}
          isLoading={this.readOnlyOverrideVerifying}
          title="Confirm With Password"
          description={`Enter your account password to unlock "${this.readOnlyOverridePasswordTarget?.label || 'this field'}".`}
          placeholder="Current password"
          confirmLabel="Unlock Field"
          cancelLabel="Cancel"
          inputType="password"
        />

        <ConfirmDialog
          isOpen={this.showDeleteConfirm}
          onClose={() => this.setShowDeleteConfirm(false)}
          onConfirm={this.handleDelete}
          isLoading={this.deleting}
          title="Delete Record"
          description="Are you sure you want to delete this record? This action is permanent and cannot be undone."
          confirmLabel="Delete Permanently"
        />
      </>
    );
  }
}
