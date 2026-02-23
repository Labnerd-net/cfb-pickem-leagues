import type { ProfileData } from '@shared/types/cfb-pickem-api';

export interface AuthResponse {
  success: boolean;
  data?: { token: string; id?: number };
  error?: string;
}

export interface UserResponse {
  success: boolean;
  data?: ProfileData;
  error?: string;
}
