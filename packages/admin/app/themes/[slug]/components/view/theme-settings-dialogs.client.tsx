import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { ThemeState } from '@fromcode119/core/client';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';

export class ThemeSettingsDialogs extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<ThemeSettingsDialogs, 'page' | 'model'>;

  @prop declare page: IThemeSettingsPageView;
  @prop declare model: ThemeSettingsRenderModel;

  render(): ReactNode {
    const page = this.page;
    const { themeDetail } = this.model;
    const { isRunSeedsConfirmOpen, isResetThemeConfirmOpen, isDeleteConfirmOpen, isReseeding, isResettingTheme, isDeleting } = page;
    return (
      <>
        <ConfirmDialog
          isOpen={isRunSeedsConfirmOpen}
          onClose={() => page.closeRunSeedsConfirm()}
          onConfirm={() => void page.handleRunSeeds()}
          title="Run Theme Seeds?"
          description={`This will replay seed content for "${themeDetail.name}" and may overwrite existing records.`}
          confirmLabel="Run Seeds"
          cancelLabel="Cancel"
          variant="primary"
          isLoading={isReseeding}
        />

        <ConfirmDialog
          isOpen={isResetThemeConfirmOpen}
          onClose={() => page.closeResetThemeConfirm()}
          onConfirm={() => void page.handleResetTheme()}
          title="Reset Theme + Re-seed?"
          description={`This resets "${themeDetail.name}" config to defaults and then runs seeds again.`}
          confirmLabel="Reset & Run Seeds"
          cancelLabel="Cancel"
          variant="danger"
          isLoading={isResettingTheme}
        />

        <ConfirmDialog
          isOpen={isDeleteConfirmOpen}
          onClose={() => page.closeDeleteConfirm()}
          onConfirm={() => void page.handleDelete()}
          title="Delete Theme?"
          description={
            themeDetail.state === ThemeState.ACTIVE
              ? `Theme "${themeDetail.name}" is active. The system will activate another theme if available, or continue with no active theme. Continue?`
              : `Are you sure you want to delete "${themeDetail.name}"? This action cannot be undone.`
          }
          confirmLabel="Delete Theme"
          cancelLabel="Cancel"
          variant="danger"
          isLoading={isDeleting}
        />
      </>
    );
  }
}
