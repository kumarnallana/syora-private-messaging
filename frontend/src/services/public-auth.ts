import type { User } from '@/types';

const API = process.env.NEXT_PUBLIC_API_URL || '';

type AuthResult = { user: User; accessToken: string; idleExpiresAt: string | null };

class PublicAuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...init, headers, credentials: 'include' });
  } catch {
    throw new PublicAuthError('SYORA could not reach the server. Check your connection and try again.', 0);
  }
  if (!response.ok) {
    let data: { error?: { message?: string } } | undefined;
    try { data = await response.clone().json(); } catch {}
    throw new PublicAuthError(data?.error?.message || `Request failed (${response.status}).`, response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export const publicAuth = {
  async restore(signal?: AbortSignal) {
    try {
      return await request<AuthResult>('/api/auth/refresh', { method: 'POST', signal });
    } catch (error) {
      if (error instanceof PublicAuthError && error.status === 401) return null;
      throw error;
    }
  },
  login(email: string, password: string) {
    return request<AuthResult>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },
  register(name: string, username: string, email: string, password: string) {
    return request<AuthResult>('/api/auth/register', { method: 'POST', body: JSON.stringify({ display_name: name, username, email, password }) });
  },
  forgotPassword(email: string) {
    return request<void>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  },
  resetPassword(token: string, password: string) {
    return request<void>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
  },
};
