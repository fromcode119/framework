import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { ClipboardCopy } from '@/lib/clipboard-copy';

/**
 * Code to read and copy: a dark block with an optional label over it and a copy button at its end.
 * It shows the text as given — it does not run, check or colour it. For code someone EDITS, use
 * `CodeEditor`.
 */
export class CodeBlock extends PureReactor {
  @prop declare code: string;
  /** What the code is — a file name, a language — in the block's head. Without one there is no head. */
  @prop declare label?: ReactNode;
  @prop declare className?: string;
  @state private copied = '';

  @bound private async copy(): Promise<void> {
    this.copied = await ClipboardCopy.write(this.code);
    window.setTimeout(() => { this.copied = ''; }, ClipboardCopy.SHOWN_MS);
  }

  render(): ReactNode {
    const box = AdminClass.of('code-block');
    const said = AdminI18n.t(ClipboardCopy.labelKey(this.copied));
    return (
      <div className={`${box} ${this.className ?? ''}`}>
        {this.label ? <div className={`${box}__head`}>{this.label}</div> : null}
        <pre className={`${box}__body`}><code>{this.code}</code></pre>
        <button type="button" className={`${box}__copy`} onClick={this.copy} aria-label={said} title={said}>
          {this.copied === ClipboardCopy.COPIED ? <FrameworkIcons.Check size={14} /> : <FrameworkIcons.Copy size={14} />}
        </button>
      </div>
    );
  }
}
