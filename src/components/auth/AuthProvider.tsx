"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { onAuthStateChange, getCurrentUser } from '@/lib/firebase/auth';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AuthProvider] Initializing...');
    
    // Timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[AuthProvider] Loading timeout - forcing loading to false');
        setLoading(false);
      }
    }, 3000);
    
    // Listen for auth state changes
    const unsubscribe = onAuthStateChange((authUser) => {
      console.log('[AuthProvider] Auth state changed:', authUser ? 'logged in' : 'logged out');
      setUser(authUser);
      setLoading(false);
      clearTimeout(timeout);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  console.log('[AuthProvider] Rendering. User:', user ? 'logged in' : 'not logged in', 'Loading:', loading);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

