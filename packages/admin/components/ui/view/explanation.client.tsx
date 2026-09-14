import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * The THIRD tier of copy under a control: label, one-line description, and then what the control
 * actually does — per state, with the related control named.
 *
 * The row-level counterpart of the field renderer's provenance line
 * (`UiFieldUtils.TEXT.PROVENANCE`, rendered by `FieldRendererFooter`). That tier exists because a
 * description says what a field IS and an operator also needs to know what it DOES and where the
 * neighbouring decision lives — the Rule Zero device this codebase already relies on. Rows built from
 * `SettingRow` had no such tier, so anything longer than a sentence was crammed into `description`
 * and read as a wall of grey text at the same weight as every other row's one-liner.
 *
 * Content is plain block children — `<p>`, `<strong>` for the term being defined, `<code>` for a
 * literal the operator can check against a real response, `<Link>` for the control that governs it.
 * Blocks, not spans: `description` renders inside a `<p>`, so multi-line copy there had to be faked
 * with `<span className="block">`, which is what this replaces.
 *
 * Deliberately quiet and small — an explanation is text under a description, not a panel. The admin
 * stays compact.
 */
export class Explanation extends PureReactor {
  @prop declare children: ReactNode;

  render(): ReactNode {
    return <div className={AdminClass.of('explanation')}>{this.children}</div>;
  }
}
