import { createContext, useContext } from 'react';
import type { ProfileData } from '@shared/types/cfb-pickem-api';

interface AuthContextType {
  user: ProfileData | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
