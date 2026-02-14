import axios from 'axios';
import type { AdminDbGameData, ProfileData, UserDbGameData, WeekQuery } from '@shared/types/cfb-pickem-api.js';

const databaseAPI = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const path = 'api/user';

export interface ProfileResponse {
  success: boolean;
  data?: ProfileData;
  error?: string;
}

export interface UserGameResponse {
  success: boolean;
  data?: UserDbGameData[];
  error?: string;
}

export interface AdminGameResponse {
  success: boolean;
  data?: AdminDbGameData[];
  error?: string;
}

export interface PicksResponse {
  success: boolean;
  data?: { status: string };
  error?: string;
}

export async function getUserProfile(): Promise<ProfileResponse> {
  try {
    const token = localStorage.getItem('jwt');
    const response = await axios.get(`${databaseAPI}/${path}/profile`, {
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
      return { success: false, error: error.response.data.error };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getUserPicks(weekData: WeekQuery): Promise<UserGameResponse> {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const response = await axios.get(`${databaseAPI}/${path}/picks`, {
      params: weekData,
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
      return { success: false, error: error.response.data.error };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getPickedGames(weekData: WeekQuery): Promise<AdminGameResponse> {
  try {
    const token = localStorage.getItem('jwt');
    const response = await axios.get(
      `${databaseAPI}/${path}/games`,
      {
        params: weekData,
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (response.data.ok) {
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

export async function postUserPicks(): Promise<PicksResponse> {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const response = await axios.post(`${databaseAPI}/${path}/picks`, {
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
      return { success: false, error: error.response.data.error };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}
