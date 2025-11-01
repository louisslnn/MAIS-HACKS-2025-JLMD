"use client";

import { MatchProvider } from "@/contexts/match-context";
import { AuthProvider } from "@/components/auth/AuthProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MatchProvider>{children}</MatchProvider>
    </AuthProvider>
  );
}
