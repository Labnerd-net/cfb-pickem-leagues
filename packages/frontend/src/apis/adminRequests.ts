import type { AdminDbGameData, WeekQuery, PickedGamesData } from '@shared/types/cfb-pickem-api';
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
    const token = localStorage.getItem('jwt');
    const response = await axios.post(
      `${databaseAPI}/${path}/year/${year}`,
      {}, // empty body
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

export async function addGamesToWeek(weekData: WeekQuery): Promise<AddGamesResponse> {
  try {
    const token = localStorage.getItem('jwt');
    const response = await axios.post(
      `${databaseAPI}/${path}/week`,
      weekData,
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

export async function getGamesForWeek(weekData: WeekQuery): Promise<GetGamesResponse> {
  try {
    const token = localStorage.getItem('jwt');
    const response = await axios.get(
      `${databaseAPI}/${path}/getgames`,
      {
        params: {
          year: weekData.year,
          week: weekData.week,
          seasonType: weekData.seasonType,
        },
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (response.data.ok) {
      return { success: true, data: response.data.data.weekGames };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      return { success: false, error: error.response.data.error };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export interface SetPicksResponse {
  success: boolean;
  data?: { status: string };
  error?: string;
}

export async function setPickedGames(pickedData: PickedGamesData): Promise<SetPicksResponse> {
  try {
    const token = localStorage.getItem('jwt');
    const response = await axios.post(
      `${databaseAPI}/${path}/setpicks`,
      pickedData,
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

