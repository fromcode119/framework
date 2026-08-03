import { useContext } from 'react';
import type { IAuthContextType } from '@/components/interfaces/auth-context-type.interface';
import { AuthStore } from '@/components/view/auth-store.client';

export class AuthHooks {
  static useAuth(): IAuthContextType {
    const context = useContext(AuthStore.context);
    if (!context) {
      throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
  }
}
