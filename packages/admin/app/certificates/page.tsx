import type { ReactNode } from 'react';
import { Reactor } from '@fromcode119/react-class-components';
import { CertificatesPageClient } from '@/app/certificates/page.client';

/** TLS certificates for every host the platform serves — platform admins only. */
export class CertificatesPage extends Reactor {
  render(): ReactNode {
    return <CertificatesPageClient />;
  }
}
