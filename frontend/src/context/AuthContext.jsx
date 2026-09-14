import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);

  const timerRef = useRef(null);
  const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

  const logout = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
  }, []);

  const login = (userData, authToken) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', authToken);
    setUser(userData);
    setToken(authToken);
  };

  // --- 15-MINUTE INACTIVITY AUTO-LOGOUT LOGIC ---
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (user) {
      timerRef.current = setTimeout(() => {
        alert('You have been logged out due to 15 minutes of inactivity.');
        logout();
        window.location.href = '/login';
      }, INACTIVITY_LIMIT_MS);
    }
  }, [user, logout]);

  useEffect(() => {
    if (!user) return;

    // Events to monitor for activity (desktop & mobile)
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    // Start timer on mount
    resetTimer();

    // Reset timer whenever user interacts
    events.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, resetTimer]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);