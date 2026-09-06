import Link from 'next/link';
import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/reactor';
import { NotFoundBody } from '@fromcode119/react/view/not-found-body';

/** The framework's 404 body under the App Router: `NotFoundBody` with `next/link` for the home action. */
export class NotFoundFallback extends PureReactor {
  render(): ReactNode {
    return <NotFoundBody linkComponent={Link} />;
  }
}
