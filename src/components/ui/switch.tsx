import * as React from "react";

import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => {
    const toggle = () => {
      if (disabled) return;
      onCheckedChange?.(!checked);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        data-state={checked ? "checked" : "unchecked"}
        onClick={toggle}
        className={cn(
          "relative inline-flex h-7 w-12 items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-brand" : "bg-[var(--ink-100)]",
          className,
        )}
        disabled={disabled}
        {...props}
      >
        <span
          className={cn(
            "inline-block h-6 w-6 transform rounded-full bg-surface shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-1",
          )}
        />
      </button>
    );
  },
);
Switch.displayName = "Switch";
