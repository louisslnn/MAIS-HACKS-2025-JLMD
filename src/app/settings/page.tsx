"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Switch,
} from "@/components/ui";
import { useAuth } from "@/components/auth/AuthProvider";
import { 
  updateUserProfile, 
  updateUserEmail, 
  updateUserPassword, 
  resetPassword,
  signOut 
} from "@/lib/firebase/auth";

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(false);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setEmail(user.email || "");
    }
  }, [user]);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-ink-soft">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleSaveProfile = async () => {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      // Update display name if changed
      if (displayName !== user.displayName) {
        await updateUserProfile(displayName);
      }

      // Update email if changed (requires password)
      if (email !== user.email) {
        if (!currentPassword) {
          setError("Current password required to change email");
          setSaving(false);
          return;
        }
        await updateUserEmail(email, currentPassword);
        setCurrentPassword("");
      }

      setSuccess("Profile updated successfully!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update profile";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setError("");
    setSuccess("");

    if (!currentPassword || !newPassword) {
      setError("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      await updateUserPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password updated successfully!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update password";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sign out";
      setError(errorMessage);
    }
  };

  const handleResetPassword = async () => {
    if (!user.email) return;
    
    setError("");
    setSuccess("");
    try {
      await resetPassword(user.email);
      setSuccess("Password reset email sent! Check your inbox.");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send reset email";
      setError(errorMessage);
    }
  };

  const avatarUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || "User")}`;

  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-4">
            <Badge variant="blue">Player settings</Badge>
            <h1>Keep your MathClash identity tidy and secure.</h1>
            <p className="max-w-2xl">
              Update your profile, manage security, and review active devices from one clean
              dashboard.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </Link>
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-2xl">Profile</CardTitle>
            <CardDescription>
              Set the name and contact information other players see across matches and leaderboards.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Image
                src={avatarUrl}
                alt="Avatar"
                width={72}
                height={72}
                className="h-16 w-16 rounded-full border border-border object-cover"
              />
              <div>
                <p className="text-sm font-semibold text-ink">{user.displayName || "Anonymous"}</p>
                <p className="text-xs text-ink-subtle">
                  Your avatar is automatically generated from your name.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-ink-soft">
                Display name
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                />
              </label>
              <label className="space-y-2 text-sm text-ink-soft">
                Email
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </label>
            </div>
            {(email !== user.email) && (
              <label className="space-y-2 text-sm text-ink-soft">
                Current Password (required to change email)
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                />
              </label>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={handleSaveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-xl">Security</CardTitle>
            <CardDescription>
              Manage your password and account security settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-ink">Change Password</p>
              <label className="space-y-2 text-sm text-ink-soft">
                Current Password
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </label>
              <label className="space-y-2 text-sm text-ink-soft">
                New Password
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 chars)"
                  minLength={6}
                />
              </label>
              <label className="space-y-2 text-sm text-ink-soft">
                Confirm New Password
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </label>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={handleChangePassword}
                disabled={saving || !currentPassword || !newPassword || !confirmPassword}
              >
                {saving ? "Updating..." : "Update Password"}
              </Button>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-ink">Password Reset</p>
                <p className="text-xs text-ink-soft">
                  Forgot your password? Send a reset link to {user.email}
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleResetPassword}
                >
                  Send Reset Email
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border bg-surface-muted px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink">
                  Multi-factor authentication
                </p>
                <p className="text-xs text-ink-subtle">
                  Coming soon - additional security for your account
                </p>
              </div>
              <Switch
                checked={mfaEnabled}
                onCheckedChange={(next) => setMfaEnabled(next)}
                aria-label="Toggle multi-factor authentication"
                disabled
              />
            </div>

            <div className="rounded-[var(--radius-sm)] border border-brand-secondary/30 bg-brand-secondary/10 px-4 py-3 text-xs text-ink">
              Keep your password secure and change it regularly for maximum protection.
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Account tips</CardTitle>
          <CardDescription>
            A few quick reminders to keep your profile in top shape.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 text-sm text-ink-soft">
          <div className="rounded-[var(--radius-sm)] border border-border bg-surface-muted px-4 py-3">
            Keep your email current so we can help you recover the account if needed.
          </div>
          <div className="rounded-[var(--radius-sm)] border border-border bg-surface-muted px-4 py-3">
            Use a strong, unique password and change it regularly for better security.
          </div>
          <div className="rounded-[var(--radius-sm)] border border-border bg-surface-muted px-4 py-3">
            Your display name is visible to other players in matches and leaderboards.
          </div>
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex flex-wrap gap-3 justify-center pb-8">
        <Button variant="primary" size="lg" asChild>
          <Link href="/play">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start Playing
          </Link>
        </Button>
        <Button variant="outline" size="lg" asChild>
          <Link href="/social">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            View Social
          </Link>
        </Button>
        <Button variant="outline" size="lg" asChild>
          <Link href="/">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
