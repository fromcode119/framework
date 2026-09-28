import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { ThemeState } from '@fromcode119/core/client';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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
          title={AdminI18n.t('themes.runThemeSeeds')}
          description={AdminI18n.t('themes.thisWillReplaySeedContent', { name: themeDetail.name })}
          confirmLabel={AdminI18n.t('themes.runSeeds')}
          cancelLabel={AdminI18n.t('themes.cancel')}
          variant="primary"
          isLoading={isReseeding}
        />

        <ConfirmDialog
          isOpen={isResetThemeConfirmOpen}
          onClose={() => page.closeResetThemeConfirm()}
          onConfirm={() => void page.handleResetTheme()}
          title={AdminI18n.t('themes.resetThemeReSeed')}
          description={AdminI18n.t('themes.thisResetsConfigToDefaults', { name: themeDetail.name })}
          confirmLabel={AdminI18n.t('themes.resetRunSeeds')}
          cancelLabel={AdminI18n.t('themes.cancel')}
          variant="danger"
          isLoading={isResettingTheme}
        />

        <ConfirmDialog
          isOpen={isDeleteConfirmOpen}
          onClose={() => page.closeDeleteConfirm()}
          onConfirm={() => void page.handleDelete()}
          title={AdminI18n.t('themes.deleteTheme')}
          description={
            themeDetail.state === ThemeState.ACTIVE
              ? AdminI18n.t('themes.themeIsActiveTheSystem2', { name: themeDetail.name })
              : AdminI18n.t('themes.areYouSureYouWant2', { name: themeDetail.name })
          }
          confirmLabel={AdminI18n.t('themes.deleteTheme2')}
          cancelLabel={AdminI18n.t('themes.cancel')}
          variant="danger"
          isLoading={isDeleting}
        />
      </>
    );
  }
}
