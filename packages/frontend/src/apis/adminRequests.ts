import axios from 'axios';

const databaseAPI = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function addWeekstoYear(year: number) {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const response = await axios.post(`${databaseAPI}/api/admin/year/${year}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error(error);
  }
}
