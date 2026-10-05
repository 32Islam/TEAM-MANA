import { useState, useEffect, useCallback } from 'react';

export const ADMIN_PASSWORD = '1122Wwssaaqq@';

export const PUBG_ADMIN_AUTH_KEY = 'pubg_admin_authenticated';
export const PUBG_ADMIN_AUTH_REMEMBER_KEY = 'pubg_admin_auth_remember';
export const ADMIN_AUTH_EVENT = 'PUBG_ADMIN_AUTH_STATE_CHANGED';

/**
 * Checks if current browser session has verified the admin password.
 */
export function checkIsAdminAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const isSessionAuth = sessionStorage.getItem(PUBG_ADMIN_AUTH_KEY) === 'true';
    const isRemembered = localStorage.getItem(PUBG_ADMIN_AUTH_REMEMBER_KEY) === 'true';
    return isSessionAuth || isRemembered;
  } catch {
    return false;
  }
}

/**
 * Validates the admin password.
 * If correct, persists auth state and emits change event.
 */
export function authenticateAdmin(password: string, rememberDevice: boolean = false): boolean {
  if (password.trim() === ADMIN_PASSWORD) {
    try {
      sessionStorage.setItem(PUBG_ADMIN_AUTH_KEY, 'true');
      if (rememberDevice) {
        localStorage.setItem(PUBG_ADMIN_AUTH_REMEMBER_KEY, 'true');
      } else {
        localStorage.removeItem(PUBG_ADMIN_AUTH_REMEMBER_KEY);
      }
      window.dispatchEvent(new CustomEvent(ADMIN_AUTH_EVENT, { detail: { authenticated: true } }));
    } catch (e) {
      console.warn('Storage error during admin auth', e);
    }
    return true;
  }
  return false;
}

/**
 * Revokes admin access and locks the console.
 */
export function lockAdmin(): void {
  try {
    sessionStorage.removeItem(PUBG_ADMIN_AUTH_KEY);
    localStorage.removeItem(PUBG_ADMIN_AUTH_REMEMBER_KEY);
    window.dispatchEvent(new CustomEvent(ADMIN_AUTH_EVENT, { detail: { authenticated: false } }));
  } catch (e) {
    console.warn('Storage error during admin lock', e);
  }
}

/**
 * React hook to observe and control admin authentication status.
 */
export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => checkIsAdminAuthenticated());

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(checkIsAdminAuthenticated());
    };

    window.addEventListener(ADMIN_AUTH_EVENT, handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener(ADMIN_AUTH_EVENT, handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  const login = useCallback((password: string, rememberDevice: boolean = false) => {
    const success = authenticateAdmin(password, rememberDevice);
    if (success) {
      setIsAuthenticated(true);
    }
    return success;
  }, []);

  const logout = useCallback(() => {
    lockAdmin();
    setIsAuthenticated(false);
  }, []);

  return {
    isAuthenticated,
    login,
    logout,
  };
}
