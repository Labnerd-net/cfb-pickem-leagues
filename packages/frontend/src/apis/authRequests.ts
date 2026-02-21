import axios from 'axios';
import type { Credentials, RegistrationData } from '@shared/types/cfb-pickem-api.js';
import type { ProfileResponse } from './userRequests';
import { logger } from '../utils/logger';

const databaseAPI = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const path = 'api/auth';

export interface AuthResponse {
  success: boolean;
  error?: string;
}

export async function loginUser(credentials: Credentials): Promise<AuthResponse> {
  try {
    const response = await axios.post(`${databaseAPI}/${path}/login`, credentials, {
      withCredentials: true,
    });
    if (response.data.ok) {
      return { success: true };
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
    const response = await axios.post(`${databaseAPI}/${path}/register`, data, {
      withCredentials: true,
    });
    if (response.data.ok) {
      return { success: true };
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

export async function logoutUser(): Promise<AuthResponse> {
  try {
    const response = await axios.post(
      `${databaseAPI}/${path}/logout`,
      {},
      { withCredentials: true }
    );
    if (response.data.ok) {
      return { success: true };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      logger.error('logoutUser failed', error.response.status, error.response.data.error);
      return { success: false, error: error.response.data.error };
    }
    logger.error('logoutUser unexpected error', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getMe(): Promise<ProfileResponse> {
  try {
    const response = await axios.get(`${databaseAPI}/${path}/me`, {
      withCredentials: true,
    });
    if (response.data.ok) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      logger.error('getMe failed', error.response.status, error.response.data.error);
      return { success: false, error: error.response.data.error };
    }
    logger.error('getMe unexpected error', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteUser(): Promise<AuthResponse> {
  try {
    const response = await axios.delete(`${databaseAPI}/${path}/deleteUser`, {
      withCredentials: true,
    });
    if (response.data.ok) {
      return { success: true };
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
