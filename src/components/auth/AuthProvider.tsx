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
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChange((authUser) => {
      setUser(authUser);
      setLoading(false); // Auth state initialized
    });

    // Set loading to false after initial check
    const currentUser = getCurrentUser();
    if (currentUser !== undefined) {
      setLoading(false);
    }

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

