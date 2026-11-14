import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/react-class-components';

/**
 * Settings section layout. The page scrolls with the document, like every other console screen: an
 * `overflow-y-auto` here never scrolled (nothing bounds its height) but still became the scroll box a
 * sticky child measures against, so the Save bar stayed at the foot of the page instead of in view.
 */
export class SettingsLayout extends Reactor {
  @prop declare children: ReactNode;

  render(): ReactNode {
    return (
      <div className="flex-1 flex flex-col h-full">
        <main className="flex-1 min-w-0">
          {this.children}
        </main>
      </div>
    );
  }
}
