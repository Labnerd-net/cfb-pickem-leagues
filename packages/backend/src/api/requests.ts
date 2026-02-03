import axios from 'axios';
import type { TvMazeShow } from '../types/tvmaze.ts';
import type { Credentials } from '../types/auth.ts';

const tvMazeAPI = 'https://api.tvmaze.com';
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

export async function getUserData(userID: string) {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const response = await axios.get(`${databaseAPI}/api/auth/${userID}`, {
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

export async function deleteUser(userID: string) {
  try {
    const token = localStorage.getItem('jwt'); // or read from a cookie
    const response = await axios.delete(`${databaseAPI}/api/auth/${userID}`, {
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

export async function addNewShowJson(showData: TvMazeShow) {
  try {
    console.log(showData);
    const response = await axios.post(`${databaseAPI}/api/tvshow`, showData);
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

export async function getAllShows() {
  try {
    console.log('All env vars:', import.meta.env);
    console.log('API URL being used:', databaseAPI);
    const response = await axios.get(`${databaseAPI}/api/tvshows`);
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

export async function getOneShow(showID: string) {
  try {
    const response = await axios.get(`${databaseAPI}/api/tvshow/${showID}`);
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

export async function updateShow(showID: string) {
  try {
    const response = await axios.patch(`${databaseAPI}/api/tvshow/${showID}`);
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

export async function deleteShow(showID: string) {
  try {
    const response = await axios.delete(`${databaseAPI}/api/tvshow/${showID}`);
    console.log(`Deleting finished.`);
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

export function returnPlatform(searchData: TvMazeShow): string {
  if (searchData.network) {
    return searchData.network.name;
  } else if (searchData.webChannel) {
    return searchData.webChannel.name;
  }
  return 'Not Available';
}

export async function returnNextEpisodeSearch(searchData: TvMazeShow): Promise<string> {
  if (searchData._links.nextepisode) {
    const nextEpisodeData = await axios.get(searchData._links.nextepisode.href);
    return new Date(nextEpisodeData.data.airdate).toDateString();
  }
  return 'No Scheduled Episode';
}

export async function tvShowResults(showName: string) {
  try {
    const response = await axios.get(`${tvMazeAPI}/search/shows?q=${showName}`)
    console.log(response.data);
    console.log(`Found ${response.data.length} shows about ${showName}`);
    return response.data;
  } catch(error) {
    console.log(error);
  }
}

export async function returnSearchShow(showId: string) {
  try {
    console.log(`URL: ${tvMazeAPI}/shows/${showId}`);
    const response = await axios.get(`${tvMazeAPI}/shows/${showId}`)
    console.log(response.data);
    return response.data;
  } catch(error) {
    console.log(error);
  }
}
