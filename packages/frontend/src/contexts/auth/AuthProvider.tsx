import { type ReactNode, useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { getMe, logoutUser } from '../../apis/authRequests';
import type { ProfileData } from '@shared/types/cfb-pickem-api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: determine auth state by calling /auth/me
  useEffect(() => {
    const initAuth = async () => {
      try {
        const result = await getMe();
        if (result.success && result.data) {
          setUser(result.data);
        }
      } catch {
        // No valid cookie — user is not authenticated
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  // Called after a successful login or register response — cookie is already set by server
  const login = async () => {
    const result = await getMe();
    if (result.success && result.data) {
      setUser(result.data);
    } else {
      throw new Error(result.error || 'Failed to fetch user profile');
    }
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
