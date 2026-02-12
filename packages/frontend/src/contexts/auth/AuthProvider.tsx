import { type ReactNode, useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { getUserProfile } from '../../apis/userRequests';
import type { ProfileData } from '@shared/types/cfb-pickem-api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: check for existing token and validate it
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('jwt');
      if (token) {
        try {
          const profileData = await getUserProfile();
          if (profileData.success && profileData.data) {
            setUser({
              userId: profileData.data.userId,
              email: profileData.data.email,
              displayName: profileData.data.displayName,
              roles: profileData.data.roles,
            });
          } else {
            // Token invalid or expired
            localStorage.removeItem('jwt');
          }
        } catch {
          // Token validation failed
          localStorage.removeItem('jwt');
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (token: string) => {
    localStorage.setItem('jwt', token);
    try {
      const profileData = await getUserProfile();
      if (profileData.success && profileData.data) {
        setUser({
          userId: profileData.data.userId,
          email: profileData.data.email,
          displayName: profileData.data.displayName,
          roles: profileData.data.roles,
        });
      } else {
        // Profile fetch failed
        localStorage.removeItem('jwt');
        throw new Error(profileData.error || 'Failed to fetch user profile');
      }
    } catch (error) {
      // Handle error - clear token if profile fetch fails
      localStorage.removeItem('jwt');
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('jwt');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
