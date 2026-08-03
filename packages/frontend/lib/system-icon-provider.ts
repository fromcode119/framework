import { FrameworkIcons } from '@fromcode119/react/icons/view/framework-icons.client';
import { FrameworkIconRegistry } from '@fromcode119/react/icons/framework-icon-registry';

/**
 * Registers the framework's built-in icon set as the `system` provider.
 *
 * This replaces `lib/icons.tsx`, which did the same work as a MODULE-LEVEL side effect: importing the
 * file registered the provider, so the registration order depended on import order and nothing could
 * run it deliberately or in a test. It also re-exported `FrameworkIcons` straight back out — a
 * pass-through barrel that hid where the icons actually come from. Callers now import `FrameworkIcons`
 * from `@fromcode119/react` directly and call `register()` from a real lifecycle.
 */
export class SystemIconProvider {
  /** Every icon name the framework set provides. */
  static names(): string[] {
    return FrameworkIcons.iconNames();
  }

  /** Register the framework icons under the `system` provider key. Safe to call more than once. */
  static register(): void {
    FrameworkIconRegistry.registerProvider('system', FrameworkIcons);
  }
}
