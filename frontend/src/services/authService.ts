import { AuthConfig, AuthResponse, UserPublic } from '../types/auth';

class AuthService {
  private inMemoryToken: string | null = null;

  setToken(token: string | null) {
    this.inMemoryToken = token;
  }

  getToken(): string | null {
    return this.inMemoryToken;
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.inMemoryToken) {
      headers['Authorization'] = `Bearer ${this.inMemoryToken}`;
    }
    return headers;
  }

  async getConfig(): Promise<AuthConfig> {
    try {
      const res = await fetch('/api/auth/config', {
        headers: this.getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Failed to fetch auth config:', err);
    }
    return {
      google_client_id: null,
      registration_enabled: true,
      password_min_length: 8,
      team_name: 'BUTANE',
      product_name: 'SkyCash',
    };
  }

  async checkSession(): Promise<UserPublic | null> {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        return data.user;
      }
    } catch {
      // Unauthenticated
    }
    return null;
  }

  private async parseJsonResponse(res: Response, fallbackError: string): Promise<any> {
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        res.status === 404
          ? 'Backend API not reachable. Please ensure your backend server is deployed and linked via vercel.json.'
          : `${fallbackError} (Server returned non-JSON HTTP ${res.status})`
      );
    }
    if (!res.ok) {
      const detail = data?.detail || data;
      const message =
        typeof detail === 'string'
          ? detail
          : detail?.message || data?.message || fallbackError;
      const code = typeof detail === 'object' ? detail?.code : undefined;
      const err = new Error(message) as Error & { code?: string };
      if (code) err.code = code;
      throw err;
    }
    return data;
  }

  async login(email: string, password: string, rememberMe: boolean = false): Promise<AuthResponse> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, remember_me: rememberMe }),
    });

    const data = await this.parseJsonResponse(res, 'Login failed.');
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, name }),
    });

    const data = await this.parseJsonResponse(res, 'Registration failed.');
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'include',
      });
    } finally {
      this.setToken(null);
    }
  }

  async loginWithGoogle(credential: string): Promise<AuthResponse> {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ credential }),
    });

    const data = await this.parseJsonResponse(res, 'Google sign-in could not be completed.');
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async forgotPassword(email: string): Promise<{ status: string; message: string }> {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    return await this.parseJsonResponse(res, 'Failed to submit reset request.');
  }
}

export const authService = new AuthService();
