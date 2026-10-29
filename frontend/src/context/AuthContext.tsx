import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthConfig, UserPublic } from '../types/auth';
import { authService } from '../services/authService';

interface AuthContextType {
  user: UserPublic | null;
  isAuthenticated: boolean;
  isAuthChecking: boolean;
  authConfig: AuthConfig;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const defaultAuthConfig: AuthConfig = {
  google_client_id: (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || null,
  registration_enabled: true,
  password_min_length: 8,
  team_name: 'BUTANE',
  product_name: 'SkyCash',
};


const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isAuthChecking: true,
  authConfig: defaultAuthConfig,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  loginWithGoogle: async () => {},
  refreshSession: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [authConfig, setAuthConfig] = useState<AuthConfig>(defaultAuthConfig);

  const refreshSession = useCallback(async () => {
    try {
      const activeUser = await authService.checkSession();
      setUser(activeUser);
    } catch {
      setUser(null);
    } finally {
      setIsAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    // Initial config and session check
    authService.getConfig().then((cfg) => {
      const viteGoogleClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
      setAuthConfig({
        ...cfg,
        google_client_id: cfg.google_client_id || viteGoogleClientId || null,
      });
    });
    refreshSession();
  }, [refreshSession]);

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    const res = await authService.login(email, password, rememberMe);
    setUser(res.user);
  };

  const register = async (email: string, password: string, name?: string) => {
    const res = await authService.register(email, password, name);
    setUser(res.user);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const loginWithGoogle = async (credential: string) => {
    const res = await authService.loginWithGoogle(credential);
    setUser(res.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAuthChecking,
        authConfig,
        login,
        register,
        logout,
        loginWithGoogle,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
