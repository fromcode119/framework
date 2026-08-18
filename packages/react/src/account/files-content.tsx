import type { ReactNode } from 'react';
import { state, prop } from '@fromcode119/reactor';
import { PluginComponent } from '@react/view/plugin-component.client';
import { AccountClass } from '@react/account/account-class';
import { AccountFileSourceRegistry } from '@react/account/account-file-source-registry';
import { FrameworkShareFileSource } from '@react/account/framework-share-file-source';
import type { IAccountFileGroup } from '@react/account/interfaces/account-file-group.interface';

/**
 * Renders every registered file source. Split from the panel for the same reason the overview is:
 * the panel reads the slot, the content does the work.
 *
 * ONE place in the account for every downloadable file the user has — course materials, purchased
 * downloads, and anything an operator sent them.
 *
 * This replaces three separate panels. `AccountSectionRegistry` could not merge them: a duplicate
 * section key makes both panels render, first-registered winning the label. So the plugins contribute
 * data through `AccountFileSourceRegistry` instead, and this panel renders whatever is there without
 * naming a single plugin.
 */
export class AccountFilesContent extends PluginComponent {
  @state loading: boolean = true;
  @state blocks: Array<{ key: string; label: string; groups: IAccountFileGroup[] }> = [];
  /** Sources that threw. Named, because silently showing fewer files is how a person loses one. */
  @state failedKeys: string[] = [];

  private mounted = false;

  @prop declare contributors?: any[];

  componentDidMount(): void {
    this.mounted = true;
    void this.load();
  }

  componentDidUpdate(prev: any): void {
    // Plugin storefront bundles register their sources asynchronously after mount, so the slot can
    // grow after the first load — reload when it does, or a late plugin's files never appear.
    if ((prev?.contributors || []).length !== (this.contributors || []).length) void this.load();
  }

  /** The framework's own shares, contributed exactly like a plugin's rather than special-cased. */
  private get allContributors(): any[] {
    return [{ component: FrameworkShareFileSource, pluginSlug: 'framework' }, ...(this.contributors || [])];
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async load(): Promise<void> {
    const { blocks, failedKeys } = await AccountFileSourceRegistry.loadAll(this.allContributors, { namespace: (ns: string) => this.namespace(ns), api: this.api, t: (key, vars) => this.t(key, vars as any) });
    if (this.mounted) this.setState({ blocks, failedKeys, loading: false });
  }

  /** Bytes for a human. Nothing for an unknown size — better blank than a made-up number. */
  private formatSize(bytes?: number): string {
    if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
  }

  /**
   * One group — a share, a lesson, an order — and the files in it.
   *
   * The heading is a HEADING, not a `row`. It used to be wrapped in one, and `.fc-acct-row` draws a
   * border and radius, so a share containing a single file rendered as two near-identical bordered
   * boxes with the same words in both.
   *
   * Each file gets the account's standard row shape — `row-main` on the left, `row-actions` on the
   * right — with a real Download button. The file name alone carried `.fc-acct-link`, a class with no
   * rule anywhere in the stylesheet, so the one action on this screen looked like plain text.
   */
  private renderGroup(group: IAccountFileGroup, index: number): ReactNode {
    // A single-file share is usually titled BY its file (the dialog pre-fills the name), so heading
    // plus row said the same words twice. The heading earns its place only when it adds information —
    // a different title, a subtitle, several files. Otherwise the row speaks for itself, and the badge
    // moves onto it rather than disappearing with the heading.
    const headingRepeatsFile = group.files.length === 1
      && !group.subtitle
      && group.title.trim().toLowerCase() === String(group.files[0]?.name || '').trim().toLowerCase();

    return (
      <div key={`${group.title}-${index}`} className={AccountClass.of('card')}>
        {headingRepeatsFile ? null : (
          <div className={AccountClass.of('group-head')}>
            <div className={AccountClass.of('row-main')}>
              <p className={AccountClass.of('card-title')}>{group.title}</p>
              {group.subtitle ? <p className={AccountClass.of('row-meta')}>{group.subtitle}</p> : null}
            </div>
            {group.badge ? <span className={AccountClass.of('badge')}>{group.badge.label}</span> : null}
          </div>
        )}

        {!group.files.length ? (
          <p className={AccountClass.of('empty-note')}>{this.t('account.files.noFiles')}</p>
        ) : (
          <ul className={AccountClass.of('rows')}>
            {group.files.map((file) => (
              <li key={file.id} className={AccountClass.of('row')}>
                <div className={AccountClass.of('row-main')}>
                  <p className={AccountClass.of('row-title')}>{file.name}</p>
                  {this.formatSize(file.size) ? (
                    <p className={AccountClass.of('row-meta')}>{this.formatSize(file.size)}</p>
                  ) : null}
                </div>
                <div className={AccountClass.of('row-actions')}>
                  {headingRepeatsFile && group.badge ? (
                    <span className={AccountClass.of('badge')}>{group.badge.label}</span>
                  ) : null}
                  <a className={AccountClass.of('btn', 'link')} href={file.href} rel="noopener">
                    {this.t('account.files.download')}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  render(): ReactNode {
    if (this.loading) return <div className={AccountClass.of('panel')}>{this.t('account.files.loading')}</div>;

    if (!this.blocks.length && !this.failedKeys.length) {
      return <div className={AccountClass.of('panel')}>{this.t('account.files.empty')}</div>;
    }

    return (
      <div className={AccountClass.of('panel')}>
        {this.failedKeys.length ? (
          // Say that something is missing rather than quietly showing a shorter list.
          <p className={AccountClass.of('row-meta')}>{this.t('account.files.partialFailure')}</p>
        ) : null}

        {this.blocks.map((block) => (
          <section key={block.key}>
            <h3 className={AccountClass.of('card-title')}>{block.label}</h3>
            {block.groups.map((group, index) => this.renderGroup(group, index))}
          </section>
        ))}
      </div>
    );
  }
}
