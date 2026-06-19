import type React from 'react';
import type { useRouter } from 'next/navigation';
import type { User } from './auth-context.interfaces';

export interface AuthProviderViewProps {
  children: React.ReactNode;
  router: ReturnType<typeof useRouter>;
}

export interface AuthProviderViewState {
  user: User | null;
  isLoading: boolean;
}
