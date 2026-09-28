import Link from 'next/link';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { NotFoundBody } from '@fromcode119/react/view/not-found-body';

/** The framework's 404 body under the App Router: `NotFoundBody` with `next/link` for the home action. */
export class NotFoundFallback extends PureReactor {
  @prop declare locale?: string;

  render(): ReactNode {
    return <NotFoundBody linkComponent={Link} locale={this.locale} />;
  }
}
