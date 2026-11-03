import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_KEY } from '../api';

const AuthContext = createContext(null);

function saveToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked (e.g. private mode): the session lasts until the page reloads.
  }
}

function hasToken() {
  try {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [manager, setManager] = useState(null);
  const [loading, setLoading] = useState(hasToken);

  const logout = useCallback(() => {
    saveToken(null);
    setManager(null);
  }, []);

  // Restore the session from a stored token.
  useEffect(() => {
    if (!hasToken()) return;
    api
      .get('/auth/me')
      .then((res) => setManager(res.data.manager))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  // api.js fires this when an authenticated request returns 401.
  useEffect(() => {
    window.addEventListener('auth:logout', logout);
    return () => window.removeEventListener('auth:logout', logout);
  }, [logout]);

  const startSession = useCallback(({ token, manager: m }) => {
    saveToken(token);
    setManager(m);
  }, []);

  // A correct password emails a 2FA code: returns { pending_token, email } for verifyCode.
  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  }, []);

  const verifyCode = useCallback(
    async (pendingToken, code) => {
      const res = await api.post('/auth/verify-2fa', { pending_token: pendingToken, code });
      startSession(res.data);
    },
    [startSession]
  );

  const resendCode = useCallback(async (pendingToken) => {
    const res = await api.post('/auth/resend-code', { pending_token: pendingToken });
    return res.data;
  }, []);

  const register = useCallback(
    async (form) => {
      const res = await api.post('/auth/register', form);
      startSession(res.data);
    },
    [startSession]
  );

  const value = useMemo(
    () => ({ manager, loading, login, verifyCode, resendCode, register, logout }),
    [manager, loading, login, verifyCode, resendCode, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
