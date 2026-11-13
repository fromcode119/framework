import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound, Platform } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A value someone copies elsewhere — an email, a phone, a SKU, a tracking number — with a small copy
 * button after it that says "Copied" for a moment. `children` is what is shown (a link, say); `value`
 * is what is copied, the shown text when left out. The look is `admin.css` (`fc-copy-value*`).
 */
export class CopyValue extends PureReactor {
  @prop declare value: string;
  @prop declare children?: ReactNode;
  @state private copied = false;

  @bound private async copy(): Promise<void> {
    if (!Platform.isBrowser) return;
    await navigator.clipboard.writeText(this.value);
    this.copied = true;
    window.setTimeout(() => { this.copied = false; }, 1500);
  }

  render(): ReactNode {
    const box = AdminClass.of('copy-value');
    const label = AdminI18n.t(this.copied ? 'collection.edit.copied' : 'collection.edit.copyTitle');
    return (
      <span className={box}>
        <span className={`${box}__text`}>{this.children ?? this.value}</span>
        <button type="button" className={`${box}__button`} onClick={this.copy} aria-label={label} title={label}>
          {this.copied ? <FrameworkIcons.Check size={12} /> : <FrameworkIcons.Copy size={12} />}
        </button>
      </span>
    );
  }
}
