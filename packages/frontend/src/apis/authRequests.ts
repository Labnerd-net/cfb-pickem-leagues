import axios from 'axios';
import type { Credentials, RegistrationData } from '@shared/types/cfb-pickem-api.js';
import { logger } from '../utils/logger';

const databaseAPI = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const path = 'api/auth';

export interface AuthResponse {
  success: boolean;
  data?: { token: string; id?: number };
  error?: string;
}

export async function loginUser(credentials: Credentials): Promise<AuthResponse> {
  try {
    const response = await axios.post(`${databaseAPI}/${path}/login`, credentials);
    if (response.data.ok) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      logger.error('loginUser failed', error.response.status, error.response.data.error);
      return { success: false, error: error.response.data.error };
    }
    logger.error('loginUser unexpected error', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function registerUser(data: RegistrationData): Promise<AuthResponse> {
  try {
    const response = await axios.post(`${databaseAPI}/${path}/register`, data);
    if (response.data.ok) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      logger.error('registerUser failed', error.response.status, error.response.data.error);
      return { success: false, error: error.response.data.error };
    }
    logger.error('registerUser unexpected error', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteUser(): Promise<AuthResponse> {
  try {
    const token = localStorage.getItem('jwt');
    const response = await axios.delete(`${databaseAPI}/${path}/deleteUser`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (response.data.ok) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      logger.error('deleteUser failed', error.response.status, error.response.data.error);
      return { success: false, error: error.response.data.error };
    }
    logger.error('deleteUser unexpected error', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
