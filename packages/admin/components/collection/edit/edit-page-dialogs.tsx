import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { PromptDialog } from '@/components/ui/view/prompt-dialog.client';
import type { IOverrideTarget } from '@/components/collection/edit/interfaces/override-target.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
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
          title={AdminI18n.t('collection.edit.unlockTitle')}
          description={AdminI18n.t('collection.edit.unlockText', { label: this.readOnlyOverrideTarget?.label || AdminI18n.t('collection.edit.thisField') })}
          confirmLabel={AdminI18n.t('common.continue')}
          cancelLabel={AdminI18n.t('common.cancel')}
          variant="primary"
        />

        <PromptDialog
          isOpen={Boolean(this.readOnlyOverridePasswordTarget)}
          onClose={() => this.setReadOnlyOverridePasswordTarget(null)}
          onConfirm={this.handleReadOnlyOverridePasswordConfirm}
          isLoading={this.readOnlyOverrideVerifying}
          title={AdminI18n.t('collection.edit.passwordTitle')}
          description={AdminI18n.t('collection.edit.passwordText')}
          placeholder={AdminI18n.t('collection.edit.passwordPlaceholder')}
          confirmLabel={AdminI18n.t('collection.edit.unlockConfirm')}
          cancelLabel={AdminI18n.t('common.cancel')}
          inputType="password"
        />

        <ConfirmDialog
          isOpen={this.showDeleteConfirm}
          onClose={() => this.setShowDeleteConfirm(false)}
          onConfirm={this.handleDelete}
          isLoading={this.deleting}
          title={AdminI18n.t('collection.list.deleteOneTitle')}
          description={AdminI18n.t('collection.list.deleteOneText')}
          confirmLabel={AdminI18n.t('collection.edit.deletePermanently')}
        />
      </>
    );
  }
}
