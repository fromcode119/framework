import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FieldHelpButton } from '@/components/collection/view/field-help-button.client';
import { Card } from '@/components/ui/view/card.client';
import { AdminClass } from '@/lib/admin-class';

/**
 * One panel on a record screen: a titled card with an optional icon, a line of explanation and an
 * action in the top-right.
 *
 * It exists because every plugin that wanted one built its own, and they drifted. On a single order
 * screen there were four: `rounded-2xl p-4`, `rounded-2xl p-5`, `rounded-3xl p-5` and
 * `rounded-xl p-4`; titles at 16px semibold, at 12px uppercase indigo, and at 12px uppercase slate
 * with 0.22em tracking; two of them with a 44px filled icon tile in different colours and corner
 * radii, the others with no icon at all. Nothing was wrong with any one of them — together they read
 * as four unrelated products stacked down one page.
 *
 * It lives in the framework rather than in a plugin because the panels that need it belong to
 * DIFFERENT plugins, and a plugin may not import another plugin's components.
 *
 * `icon` is accepted for the panels that pass one, and not drawn: the record's own cards carry no icon
 * beside their titles, and one glyph on a plugin's panel was what set it apart from them.
 */
export class AdminPanel extends Reactor {
  @prop declare title: string;
  @prop declare description?: string;
  @prop declare icon?: ReactNode;
  /** Rendered top-right, aligned with the TITLE — not centred against the panel's full height. */
  @prop declare actions?: ReactNode;
  @prop declare children?: ReactNode;
  @prop declare className?: string;

  /** An action-only panel keeps its explanation behind the help control; this is that control's state. */
  @state helpOpen = false;

  @bound private toggleHelp(): void {
    this.helpOpen = !this.helpOpen;
  }

  /** True when a children value would draw something: `false`, `null` and empty lists draw nothing. */
  private static hasContent(children: ReactNode): boolean {
    if (Array.isArray(children)) return children.some((child) => AdminPanel.hasContent(child));
    return children !== null && children !== undefined && children !== false && children !== true && children !== '';
  }

  /**
   * Whether the panel holds content of its own. A panel that only ever renders a dialog passes
   * `[null, null]` while the dialog is closed, which is an array and so truthy — count what would
   * actually be drawn.
   */
  private get hasBody(): boolean {
    return AdminPanel.hasContent(this.children);
  }

  /**
   * Drawn as a saved record's section card (`fc-record-card` in admin.css): the same head — title on the
   * left, what the plugin offers on the right, a dashed rule under it — and the same body padding, so a
   * plugin's panel beside the record's own cards reads as one more of them, not as a second design.
   *
   * A panel with only a title and an action is that head alone. Its description says what the button
   * does, which is read once, so it waits behind the help control like a field's does.
   */
  render(): ReactNode {
    const { title, description, actions } = this;
    const card = AdminClass.of('record-card');
    const body = this.hasBody;
    const helpOnly = !body && Boolean(actions);
    return (
      <Card noPadding className={`${card} fc-admin-panel${body ? ' fc-admin-panel--body' : ''}${this.className ? ` ${this.className}` : ''}`}>
        <div className={`${card}__head${body || (description && !helpOnly) ? '' : ' fc-admin-panel__head--alone'}`}>
          <h2 className={`${card}__title fc-admin-panel__title`}>
            {title}
            {helpOnly && description ? <FieldHelpButton label={title} open={this.helpOpen} onToggle={this.toggleHelp} /> : null}
          </h2>
          {actions ? <div className={`${card}__aside fc-admin-panel__actions`}>{actions}</div> : null}
        </div>
        {(description && (!helpOnly || this.helpOpen)) || body ? (
          <div className="fc-admin-panel__body">
            {description && (!helpOnly || this.helpOpen) ? <p className="fc-admin-panel__description">{description}</p> : null}
            {this.children}
          </div>
        ) : this.children}
      </Card>
    );
  }
}
