import { DependencyIssueType } from '@/components/ui/enums/dependency-issue-type.enum';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { FrameworkIcons } from '@fromcode119/react';
import { IDependencyIssue } from '@/components/ui/interfaces/dependency-issue.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What this plugin needs before it can run, and the two ways forward.
 *
 * The dialog is the console's ({@link Dialog}); this one lists the plugins it depends on, each with
 * what is wrong with it. It used to draw its own scrim and panel, an icon tile in rose or amber, a
 * tag at 8px — the smallest text in the console, against a 12px floor — and three buttons at `py-6`
 * with coloured shadows.
 */
export class DependencyDialog extends PureReactor {
  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  @prop declare onConfirm: (recursive: boolean, force: boolean) => void;
  @prop declare issues: IDependencyIssue[];
  @prop declare pluginSlug: string;
  @prop declare isLoading?: boolean;

  @bound private confirmResolve(): void {
    this.onConfirm(true, false);
  }

  @bound private confirmForce(): void {
    this.onConfirm(false, true);
  }

  private is(issue: IDependencyIssue, type: DependencyIssueType): boolean {
    return String(issue.type) === type.value;
  }

  private get hasMissing(): boolean {
    return this.issues.some((issue) => this.is(issue, DependencyIssueType.MISSING));
  }

  private get primaryLabel(): string {
    if (this.hasMissing) return AdminI18n.t('ui.dependencies.installAll');
    const onlyInactive = this.issues.every((issue) => this.is(issue, DependencyIssueType.INACTIVE));
    return onlyInactive ? AdminI18n.t('ui.dependencies.enableAll') : AdminI18n.t('ui.dependencies.resolve');
  }

  /** What state the dependency is in, as a word: not installed, off, wrong version. */
  /** NOT `state`: that is React's own member on a component, and a method of that name makes the
   *  class itself an invalid JSX type. */
  private stateLabel(issue: IDependencyIssue): string {
    if (this.is(issue, DependencyIssueType.MISSING)) return AdminI18n.t('ui.dependencies.notInstalled');
    if (this.is(issue, DependencyIssueType.INACTIVE)) return AdminI18n.t('ui.dependencies.inactive');
    return AdminI18n.t('ui.dependencies.incompatible');
  }

  /** What is wrong with one dependency, in the words the operator reads. */
  private reason(issue: IDependencyIssue): string {
    if (this.is(issue, DependencyIssueType.MISSING)) return AdminI18n.t('ui.dependencies.requires', { version: issue.expected });
    if (this.is(issue, DependencyIssueType.INACTIVE)) return AdminI18n.t('ui.dependencies.needsActivation', { version: issue.expected });
    return AdminI18n.t('ui.dependencies.mismatch', { expected: issue.expected, actual: issue.actual });
  }

  private get foot(): ReactNode {
    const isLoading = this.isLoading ?? false;
    const hasIncompatible = this.issues.some((issue) => this.is(issue, DependencyIssueType.INCOMPATIBLE));
    return (
      <>
        <Button variant={ButtonVariant.GHOST} onClick={this.onClose} disabled={isLoading}>
          {AdminI18n.t('common.cancel')}
        </Button>
        <Button variant={ButtonVariant.GHOST} onClick={this.confirmForce} disabled={isLoading}>
          {AdminI18n.t('ui.dependencies.force')}
        </Button>
        {hasIncompatible ? null : (
          <Button variant={ButtonVariant.PRIMARY} onClick={this.confirmResolve} isLoading={isLoading}>
            {this.primaryLabel}
          </Button>
        )}
      </>
    );
  }

  render(): ReactNode {
    return (
      <EditSheet
        isOpen={this.isOpen}
        onClose={this.onClose}
        title={AdminI18n.t(this.hasMissing ? 'ui.dependencies.missingTitle' : 'ui.dependencies.inactiveTitle')}
        subtitle={AdminI18n.t('ui.dependencies.intro', { plugin: this.pluginSlug })}
        saving={this.isLoading ?? false}
        foot={this.foot}
      >
        <ul className="fc-dependency">
          {this.issues.map((issue, index) => (
            <li key={`${issue.slug}-${index}`} className="fc-dependency__row">
              <span className="fc-dependency__mark"><FrameworkIcons.Box size={16} /></span>
              <span className="fc-dependency__text">
                <span className="fc-dependency__name">
                  {issue.slug}
                  {/* The chip is read by the shop owner, so it is a word — never the enum's own value,
                      which put a lowercase English "inactive" on a Bulgarian screen. */}
                  <span className="fc-chip">{this.stateLabel(issue)}</span>
                </span>
                <span className="fc-dependency__reason">{this.reason(issue)}</span>
              </span>
            </li>
          ))}
        </ul>
        {/* What forcing it means, where the button that does it is — not a block of its own above it. */}
        <p className="fc-dependency__warning">{AdminI18n.t('ui.dependencies.forceWarning')}</p>
      </EditSheet>
    );
  }
}
