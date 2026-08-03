import { createContext } from 'react';
import type { IAuthContextType } from '@/components/interfaces/auth-context-type.interface';

export class AuthStore {
  static readonly context = createContext<IAuthContextType | null>(null);
}
