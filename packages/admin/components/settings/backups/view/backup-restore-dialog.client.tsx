import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { RestoreTargetScope } from '@/components/settings/backups/enums/restore-target-scope.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { TextArea } from '@/components/ui/view/text-area.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IRestoreDialogState } from '@/components/settings/backups/interfaces/restore-dialog-state.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';

/**
 * Restoring a backup: what is being restored, where to, and the words that have to be typed first.
 *
 * The dialog is the console's ({@link Dialog}) and its blocks are the console's panels. It used to
 * draw its own scrim and panel, a 48px amber tile, and eight boxes whose border and background were
 * written out per theme (`theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-900/70' : …`) — 68
 * colours in one file, none of which a brand or the dark scheme could reach.
 */
export class BackupRestoreDialog extends PureReactor {
  @prop declare isOpen: boolean;
  @prop declare isPreviewing: boolean;
  @prop declare isRestoring: boolean;
  @prop declare onClose: () => void;
  @prop declare onTargetScopeChange: (value: RestoreTargetScope) => void;
  @prop declare onTargetSlugChange: (value: string) => void;
  @prop declare onConfirmationTextChange: (value: string) => void;
  @prop declare onPreview: () => Promise<void>;
  @prop declare onExecute: () => Promise<void>;

  /** The `state` prop — read via a getter because `this.state` is owned by React. */
  private get restoreState(): IRestoreDialogState {
    return this.props.state as IRestoreDialogState;
  }

  private scopeLabel(scope: RestoreTargetScope): string {
    if (scope === RestoreTargetScope.SYSTEM) return AdminI18n.t('settings.components.systemRoot');
    if (scope === RestoreTargetScope.PLUGIN) return AdminI18n.t('settings.components.pluginSlug');
    return AdminI18n.t('settings.components.themeSlug');
  }

  private get foot(): ReactNode {
    const state = this.restoreState;
    return (
      <>
        <Button variant={ButtonVariant.SECONDARY} onClick={this.onClose} disabled={this.isPreviewing || this.isRestoring}>
          {AdminI18n.t('settings.components.close')}
        </Button>
        <Button
          variant={ButtonVariant.DANGER}
          isLoading={this.isRestoring}
          onClick={() => void this.onExecute()}
          disabled={!state.preview}
        >
          {AdminI18n.t('settings.components.executeRestore')}
        </Button>
      </>
    );
  }

  /** Which backup is being restored. */
  private get chosen(): ReactNode {
    const backup = this.restoreState.backup!;
    return (
      <section className="fc-block">
        <h4 className="fc-block__title">{AdminI18n.t('settings.components.selectedBackup')}</h4>
        <p className="fc-block__value">{backup.displayName}</p>
        <p className="fc-block__quiet">{backup.filename}</p>
      </section>
    );
  }

  /** Where it goes: the whole system, one plugin or one theme. */
  private get target(): ReactNode {
    const state = this.restoreState;
    return (
      <section className="fc-block">
        <h4 className="fc-block__title">{AdminI18n.t('settings.components.restoreTarget')}</h4>
        <Select
          value={state.targetScope.value}
          options={(RestoreTargetScope.values() as RestoreTargetScope[]).map((scope) => ({ value: scope.value, label: this.scopeLabel(scope) }))}
          onChange={(value: string) => this.onTargetScopeChange(RestoreTargetScope.fromValue(value) as RestoreTargetScope)}
        />
        {state.targetScope === RestoreTargetScope.SYSTEM ? null : (
          <Input
            label={state.targetScope === RestoreTargetScope.PLUGIN
              ? AdminI18n.t('settings.components.pluginSlug2')
              : AdminI18n.t('settings.components.themeSlug2')}
            value={state.targetSlug}
            onChange={(event) => this.onTargetSlugChange(event.target.value)}
            placeholder={state.targetScope === RestoreTargetScope.PLUGIN ? 'example-plugin' : 'example-theme'}
          />
        )}
        <p className="fc-block__quiet">{AdminI18n.t('settings.components.theBrowserSendsOnlyApproved')}</p>
      </section>
    );
  }

  /** The server's own check, and the words that unlock the restore once it passes. */
  private get preview(): ReactNode {
    const state = this.restoreState;
    return (
      <section className="fc-block">
        <div className="fc-block__head">
          <div>
            <h4 className="fc-block__title">{AdminI18n.t('settings.components.serverPreview')}</h4>
            <p className="fc-block__quiet">{AdminI18n.t('settings.components.previewRevalidatesTheBackupId')}</p>
          </div>
          <Button variant={ButtonVariant.SECONDARY} isLoading={this.isPreviewing} onClick={() => void this.onPreview()}>
            {AdminI18n.t('settings.components.runPreview')}
          </Button>
        </div>
        {state.preview ? (
          <>
            <p className="fc-block__value">
              <AdminRichText k="settings.components.targetValidated" vars={{ target: state.preview.targetLabel, snapshot: state.preview.snapshotType.value }} />
            </p>
            <div>
              <h5 className="fc-block__title">{AdminI18n.t('settings.components.confirmationChallenge')}</h5>
              <p className="fc-block__code">{state.preview.requiredConfirmationText}</p>
            </div>
            <TextArea
              label={AdminI18n.t('settings.components.typeTheConfirmationTextExactly')}
              value={state.confirmationText}
              onChange={(event) => this.onConfirmationTextChange(event.target.value)}
              placeholder={AdminI18n.t('settings.components.pasteTheConfirmationChallengeHere')}
            />
          </>
        ) : (
          <p className="fc-block__quiet">{AdminI18n.t('settings.components.previewTheRestoreFirstTo')}</p>
        )}
      </section>
    );
  }

  /** What the preview found worth saying, and anything the form itself refuses. */
  private get warnings(): ReactNode {
    const state = this.restoreState;
    return (
      <section className="fc-block">
        <h4 className="fc-block__title">{AdminI18n.t('settings.components.warnings')}</h4>
        {state.preview?.warnings?.length ? (
          <ul className="fc-block__list">
            {state.preview.warnings.map((warning) => (
              <li key={warning} className="fc-block__warning">
                <FrameworkIcons.Warning size={14} />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fc-block__quiet">{AdminI18n.t('settings.components.warningsWillAppearHereAfter')}</p>
        )}
        
      </section>
    );
  }

  render(): ReactNode {
    if (!this.isOpen || !this.restoreState.backup) return null;
    return (
      <EditSheet
        isOpen={this.isOpen}
        onClose={this.onClose}
        title={AdminI18n.t('settings.components.previewRestore')}
        subtitle={AdminI18n.t('settings.components.validateTargetScopeReviewWarnings')}
        saving={this.isPreviewing || this.isRestoring}
        error={this.restoreState.formError || undefined}
        foot={this.foot}
      >
        {/* One column, in the order the work happens: what, where, the server's check, what it warns
            about. Two columns inside a 720px dialog made four boxes of 300px and broke the reading
            down the page (NN/g, web form design #3). */}
        <div className="fc-restore">
          <p className="fc-tip fc-tip--warning"><span>{AdminI18n.t('settings.components.restoreNeverRunsDirectlyFrom')}</span></p>
          {this.chosen}
          {this.target}
          {this.preview}
          {this.warnings}
        </div>
      </EditSheet>
    );
  }
}
