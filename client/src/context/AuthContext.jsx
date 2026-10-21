import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, jsonBody } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore a session after refresh; the backend validates the token and account.
    if (!localStorage.getItem('akshar_token')) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('akshar_token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const result = await api('/auth/login', { method: 'POST', body: jsonBody({ username, password }) });
    localStorage.setItem('akshar_token', result.token);
    setUser(result.user);
    return result.user;
  }

  function logout() {
    localStorage.removeItem('akshar_token');
    setUser(null);
  }

  const value = useMemo(() => ({ user, loading, login, logout, setUser }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
