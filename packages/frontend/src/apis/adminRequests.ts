import type { AdminDbGameData, WeekIdData } from '@shared/types/cfb-pickem-api';
import axios from 'axios';

const databaseAPI = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const path = 'api/admin';

export async function addWeekstoYear(year: number) {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const response = await axios.post(`${databaseAPI}/${path}/year/${year}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log(response.data);
    return response.data; // ok or err
  } catch (error) {
    console.error(error);
  }
}

export async function addGamesToWeek() {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const response = await axios.post(`${databaseAPI}/${path}/week`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log(response.data);
    return response.data; // ok or err
  } catch (error) {
    console.error(error);
  }
}

export async function getAllGames() {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const weekData: WeekIdData = {
      year: 2025,
      week: 1,
      seasonType: 'regular',
    };
    const response = await axios.post<AdminDbGameData[]>(
      `${databaseAPI}/${path}/getgames`,
      weekData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(response.data);
    return response.data; // Admin DB game data
  } catch (error) {
    console.error(error);
  }
}

export async function getPickedGames() {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const weekData: WeekIdData = {
      year: 2025,
      week: 1,
      seasonType: 'regular',
    };
    const response = await axios.post<AdminDbGameData[]>(
      `${databaseAPI}/${path}/getpicked`,
      weekData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log(response.data);
    return response.data; // Admin DB game data
  } catch (error) {
    console.error(error);
  }
}
