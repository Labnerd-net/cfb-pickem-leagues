import axios from 'axios';
import type { Credentials } from '@shared/types/cfb-pickem-api.js';

const databaseAPI = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function loginUser(credentials: Credentials) {
  try {
    const response = await axios.post(`${databaseAPI}/api/auth/login`, credentials);
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

export async function registerUser(credentials: Credentials) {
  try {
    const response = await axios.post(`${databaseAPI}/api/auth/register`, credentials);
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

export async function deleteUser() {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const response = await axios.delete(`${databaseAPI}/api/auth/deleteUser`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log(`Deleting finished.`);
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error(error);
  }
}
