import type React from 'react';
import type { useRouter } from 'next/navigation';

export interface IAuthProviderViewProps {
  children: React.ReactNode;
  router: ReturnType<typeof useRouter>;
}
