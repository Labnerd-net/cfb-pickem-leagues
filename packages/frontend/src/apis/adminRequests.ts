import type { AdminDbGameData, WeekIdData } from '@shared/types/cfb-pickem-api';
import axios from 'axios';

const databaseAPI = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const path = 'api/admin';

export interface AddWeeksResponse {
  success: boolean;
  data?: { status: string };
  error?: string;
}

export interface AddGamesResponse {
  success: boolean;
  data?: { status: string };
  error?: string;
}

export interface GetGamesResponse {
  success: boolean;
  data?: AdminDbGameData[];
  error?: string;
}

export async function addWeekstoYear(year: number): Promise<AddWeeksResponse> {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const response = await axios.post(`${databaseAPI}/${path}/year/${year}`, {
      headers: { Authorization: `Bearer ${token}` },
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

export async function addGamesToWeek(): Promise<AddGamesResponse> {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const response = await axios.post(`${databaseAPI}/${path}/week`, {
      headers: { Authorization: `Bearer ${token}` },
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

export async function getAllGames(): Promise<GetGamesResponse> {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const weekData: WeekIdData = {
      year: 2025,
      week: 1,
      seasonType: 'regular',
    };
    const response = await axios.post(`${databaseAPI}/${path}/getgames`,  weekData,
      { headers: { Authorization: `Bearer ${token}` } }
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

