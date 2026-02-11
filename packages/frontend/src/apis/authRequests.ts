import axios from 'axios';
import type { Credentials, RegistrationData } from '@shared/types/cfb-pickem-api.js';

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
      localStorage.setItem('jwt', response.data.data.token);
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      return { success: false, error: error.response.data.error };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function registerUser(data: RegistrationData): Promise<AuthResponse> {
  const { email, password, displayName } = data;
  try {
    const response = await axios.post(`${databaseAPI}/${path}/register`, {
      email,
      password,
      displayName,
    });
    if (response.data.ok) {
      localStorage.setItem('jwt', response.data.data.token);
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      return { success: false, error: error.response.data.error };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteUser() {
  try {
    const token = localStorage.getItem('jwt');
    const response = await axios.delete(`${databaseAPI}/${path}/deleteUser`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data.data;
  } catch (error) {
    console.error(error);
  }
}
