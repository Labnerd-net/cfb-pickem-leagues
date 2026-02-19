import type { AdminDbGameData, AdminDbWeekData, WeekIdentifier, PickedGamesRequest } from '@shared/types/cfb-pickem-api';
import axios from 'axios';
import { logger } from '../utils/logger';

const databaseAPI = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const path = 'api/admin';

export interface AddWeeksResponse {
  success: boolean;
  data?: { status: string };
  error?: string;
}

export interface GetWeeksResponse {
  success: boolean;
  data?: AdminDbWeekData[];
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

export async function addWeeksToYear(year: number): Promise<AddWeeksResponse> {
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
      logger.error('addWeeksToYear failed', error.response.status, error.response.data.error);
      return { success: false, error: error.response.data.error };
    }
    logger.error('addWeeksToYear unexpected error', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getWeeksForYear(year: number): Promise<GetWeeksResponse> {
  try {
    const token = localStorage.getItem('jwt');
    const response = await axios.get(
      `${databaseAPI}/${path}/weeks`,
      {
        params: { year },
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (response.data.ok) {
      return { success: true, data: response.data.data.weeks };
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

export async function addGamesToWeek(weekData: WeekIdentifier): Promise<AddGamesResponse> {
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
      logger.error('addGamesToWeek failed', error.response.status, error.response.data.error);
      return { success: false, error: error.response.data.error };
    }
    logger.error('addGamesToWeek unexpected error', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getGamesForWeek(weekData: WeekIdentifier): Promise<GetGamesResponse> {
  try {
    const token = localStorage.getItem('jwt');
    const response = await axios.get(
      `${databaseAPI}/${path}/games`,
      {
        params: {
          year: weekData.year,
          week: weekData.week,
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
      logger.error('getGamesForWeek failed', error.response.status, error.response.data.error);
      return { success: false, error: error.response.data.error };
    }
    logger.error('getGamesForWeek unexpected error', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export interface SetPicksResponse {
  success: boolean;
  data?: { status: string };
  error?: string;
}

export async function setPickedGames(pickedData: PickedGamesRequest): Promise<SetPicksResponse> {
  try {
    const token = localStorage.getItem('jwt');
    const response = await axios.post(
      `${databaseAPI}/${path}/picks`,
      pickedData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.data.ok) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      logger.error('setPickedGames failed', error.response.status, error.response.data.error);
      return { success: false, error: error.response.data.error };
    }
    logger.error('setPickedGames unexpected error', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

