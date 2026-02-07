import axios from 'axios';
import type { ProfileData, UserDbGameData } from '@shared/types/cfb-pickem-api.js';

const databaseAPI = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const path = 'api/user';

export async function getUserProfile() {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const response = await axios.get<ProfileData>(`${databaseAPI}/${path}/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log(response.data);
    return response.data; // {userId, email, roles}
  } catch (error) {
    console.error(error);
  }
}

export async function getUserPicks() {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const response = await axios.get<UserDbGameData[]>(`${databaseAPI}/${path}/picks`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log(response.data);
    return response.data; //
  } catch (error) {
    console.error(error);
  }
}

export async function postUserPicks() {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const response = await axios.post(`${databaseAPI}/${path}/picks`, {
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
