import * as React from "react";

import { cn } from "@/lib/utils";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "blue" | "mint" | "slate" | "amber";
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  blue: "bg-brand-secondary/15 text-brand-secondary",
  mint: "bg-success/10 text-success",
  slate: "bg-[var(--ink-100)] text-ink-soft",
  amber: "bg-warning/15 text-warning",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "blue", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  ),
);
Badge.displayName = "Badge";
