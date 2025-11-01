"use client";

import { useState, useEffect } from "react";

interface RoundTimerProps {
  endsAt: string | Date | null | undefined | { toDate(): Date } | { seconds: number; nanoseconds?: number };
  onExpired?: () => void;
}

function resolveEndDate(endsAt: RoundTimerProps["endsAt"]): Date | null {
  if (!endsAt) return null;
  if (endsAt instanceof Date) return endsAt;
  if (typeof endsAt === "string") {
    const parsed = new Date(endsAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof (endsAt as { toDate?: () => Date }).toDate === "function") {
    const converted = (endsAt as { toDate: () => Date }).toDate();
    return converted instanceof Date ? converted : null;
  }
  if (
    typeof (endsAt as { seconds?: number }).seconds === "number"
  ) {
    const seconds = (endsAt as { seconds: number }).seconds;
    const nanoseconds = (endsAt as { nanoseconds?: number }).nanoseconds ?? 0;
    return new Date(seconds * 1000 + Math.floor(nanoseconds / 1_000_000));
  }
  if (typeof (endsAt as unknown as { getTime?: () => number }).getTime === "function") {
    const millis = (endsAt as unknown as { getTime: () => number }).getTime();
    return Number.isNaN(millis) ? null : new Date(millis);
  }
  return null;
}

export function RoundTimer({ endsAt, onExpired }: RoundTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setExpired(false);
    setTimeRemaining(0);
  }, [endsAt]);

  useEffect(() => {
    const updateTimer = () => {
      const endTime = resolveEndDate(endsAt);
      if (!endTime) {
        setTimeRemaining(0);
        setExpired((prev) => {
          if (!prev) {
            onExpired?.();
          }
          return true;
        });
        return;
      }

      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime.getTime() - now) / 1000));

      setTimeRemaining(remaining);

      if (remaining === 0) {
        setExpired((prev) => {
          if (!prev) {
            onExpired?.();
          }
          return true;
        });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [endsAt, onExpired]);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isLow = timeRemaining < 10;

  if (expired) {
    return (
      <div className="text-center">
        <p className="text-red-500 font-semibold">Time&apos;s Up!</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className={`text-2xl font-mono font-bold ${isLow ? "text-red-500" : "text-ink"}`}>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </p>
      <p className="text-xs text-ink-soft mt-1">Time remaining</p>
    </div>
  );
}
