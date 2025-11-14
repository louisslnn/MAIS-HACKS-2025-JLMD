"use client";

import { LoginButton } from "./LoginButton";

export function SignInPrompt() {
  return (
    <div className="max-w-md mx-auto text-center space-y-6 p-8 rounded-2xl bg-gradient-to-br from-brand/10 to-brand-secondary/10 border-2 border-brand/30">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white mb-2">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      
      <div>
        <h3 className="text-2xl font-bold text-ink mb-2">Sign In to Play</h3>
        <p className="text-ink-soft">
          Create a free account to compete in math battles and track your progress
        </p>
      </div>

      <div className="pt-4">
        <LoginButton />
      </div>
    </div>
  );
}





