import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "subtle" | "ghost";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white shadow-sm hover:bg-brand/90 focus-visible:ring-brand",
  secondary:
    "bg-brand-secondary/10 text-brand-secondary hover:bg-brand-secondary/20 focus-visible:ring-brand-secondary",
  outline:
    "border border-border text-ink hover:bg-surface-muted focus-visible:ring-border",
  subtle:
    "bg-surface text-ink hover:bg-surface-highlight focus-visible:ring-border",
  ghost:
    "text-ink-soft hover:text-ink hover:bg-surface-muted focus-visible:ring-border",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 rounded-full px-4 text-sm",
  md: "h-11 rounded-full px-5 text-sm",
  lg: "h-12 rounded-full px-6 text-base",
  icon: "h-10 w-10 rounded-full",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted disabled:pointer-events-none disabled:opacity-50";

export function buttonVariants({
  variant = "primary",
  size = "md",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
} = {}) {
  return cn(baseClasses, variantClasses[variant], sizeClasses[size]);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", type = "button", asChild = false, ...props },
    ref,
  ) => {
    if (asChild) {
      return (
        <Slot
          ref={ref as React.Ref<HTMLButtonElement>}
          className={cn(buttonVariants({ variant, size }), className)}
          {...props}
        />
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
