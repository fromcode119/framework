import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/reactor';

/** Settings section layout. */
export class SettingsLayout extends Reactor {
  @prop declare children: ReactNode;

  render(): ReactNode {
    return (
      <div className="flex-1 flex flex-col h-full">
        <main className="flex-1 overflow-y-auto min-w-0">
          {this.children}
        </main>
      </div>
    );
  }
}
