import axios from 'axios';
import type { Credentials } from '@shared/types/cfb-pickem-api.js';

const databaseAPI = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const path = 'api/auth';

export async function loginUser(credentials: Credentials) {
  try {
    const response = await axios.post(`${databaseAPI}/${path}/login`, credentials);
    console.log(response.data);
    localStorage.setItem('jwt', response.data.token);
    return response.data; // {userId, jwt token}
  } catch (error) {
    console.error(error);
  }
}

export async function registerUser(credentials: Credentials) {
  try {
    const response = await axios.post(`${databaseAPI}/${path}/register`, credentials);
    console.log(response.data);
    localStorage.setItem('jwt', response.data.token);
    return response.data; // {jwt token}
  } catch (error) {
    console.error(error);
  }
}

export async function deleteUser() {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const response = await axios.delete(`${databaseAPI}/${path}/deleteUser`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log(response.data); // ok or err
    return response.data;
  } catch (error) {
    console.error(error);
  }
}
