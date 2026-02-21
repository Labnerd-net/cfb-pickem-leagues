import axios from 'axios';
import type { AdminDbGameData, AdminDbWeekData, AllUserGamePicksRequest, ProfileData, UserDbGameData, WeekIdentifier } from '@shared/types/cfb-pickem-api.js';
import { logger } from '../utils/logger';

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

export interface GetWeeksResponse {
  success: boolean;
  data?: { weeks: AdminDbWeekData[] };
  error?: string;
}

export async function getUserProfile(): Promise<ProfileResponse> {
  try {
    const response = await axios.get(`${databaseAPI}/${path}/profile`, {
      withCredentials: true,
    });
    if (response.data.ok) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      logger.error('getUserProfile failed', error.response.status, error.response.data.error);
      return { success: false, error: error.response.data.error };
    }
    logger.error('getUserProfile unexpected error', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getWeeksForYear(year: number): Promise<GetWeeksResponse> {
  try {
    const response = await axios.get(`${databaseAPI}/${path}/weeks`, {
      params: { year },
      withCredentials: true,
    });
    if (response.data.ok) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      logger.error('getWeeksForYear failed', error.response.status, error.response.data.error);
      return { success: false, error: error.response.data.error };
    }
    logger.error('getWeeksForYear unexpected error', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getUserPicks(weekData: WeekIdentifier): Promise<UserGameResponse> {
  try {
    const response = await axios.get(`${databaseAPI}/${path}/picks`, {
      params: weekData,
      withCredentials: true,
    });
    if (response.data.ok) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      logger.error('getUserPicks failed', error.response.status, error.response.data.error);
      return { success: false, error: error.response.data.error };
    }
    logger.error('getUserPicks unexpected error', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getPickedGames(weekData: WeekIdentifier): Promise<AdminGameResponse> {
  try {
    const response = await axios.get(`${databaseAPI}/${path}/games`, {
      params: weekData,
      withCredentials: true,
    });
    if (response.data.ok) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      logger.error('getPickedGames failed', error.response.status, error.response.data.error);
      return { success: false, error: error.response.data.error };
    }
    logger.error('getPickedGames unexpected error', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function postUserPicks(picks: AllUserGamePicksRequest): Promise<PicksResponse> {
  try {
    const response = await axios.post(`${databaseAPI}/${path}/picks`, picks, {
      withCredentials: true,
    });
    if (response.data.ok) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      logger.error('postUserPicks failed', error.response.status, error.response.data.error);
      return { success: false, error: error.response.data.error };
    }
    logger.error('postUserPicks unexpected error', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
