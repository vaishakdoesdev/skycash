export interface UserPublic {
  id: string;
  email: string;
  name: string;
  auth_provider: 'local' | 'google' | string;
  created_at: string;
}

export interface AuthConfig {
  google_client_id: string | null;
  registration_enabled: boolean;
  password_min_length: number;
  team_name: string;
  product_name: string;
}

export interface AuthResponse {
  user: UserPublic;
  token: string;
  expires_in_seconds: number;
}
