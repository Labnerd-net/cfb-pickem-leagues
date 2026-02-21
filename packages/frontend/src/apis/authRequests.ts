import type { Credentials, RegistrationData } from '@shared/types/cfb-pickem-api.js';
import type { ProfileResponse } from './userRequests';
import { client } from '../lib/api';

export interface AuthResponse {
  success: boolean;
  error?: string;
}

export async function loginUser(credentials: Credentials): Promise<AuthResponse> {
  try {
    const res = await client.api.auth.login.$post({ json: credentials });
    if (!res.ok) {
      const body = await res.json() as unknown as { error: string };
      return { success: false, error: body.error };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function registerUser(data: RegistrationData): Promise<AuthResponse> {
  try {
    const res = await client.api.auth.register.$post({ json: data });
    if (!res.ok) {
      const body = await res.json() as unknown as { error: string };
      return { success: false, error: body.error };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function logoutUser(): Promise<AuthResponse> {
  try {
    const res = await client.api.auth.logout.$post();
    if (!res.ok) {
      const body = await res.json() as unknown as { error: string };
      return { success: false, error: body.error };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function getMe(): Promise<ProfileResponse> {
  try {
    const res = await client.api.auth.me.$get();
    if (!res.ok) {
      const body = await res.json() as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const data = await res.json();
    return { success: true, data };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function deleteUser(): Promise<AuthResponse> {
  try {
    const res = await client.api.auth.deleteUser.$delete();
    if (!res.ok) {
      const body = await res.json() as unknown as { error: string };
      return { success: false, error: body.error };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}
