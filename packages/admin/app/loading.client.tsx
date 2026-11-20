import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/react-class-components';
import { Loader } from '@/components/ui/view/loader.client';

// Next.js App Router route loading UI — client component, so a class renders fine.
export class GlobalLoading extends PureReactor {
  render(): ReactNode {
    // The console's loader, with the wording that rotates so a slow page does not look frozen.
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    );
  }
}
