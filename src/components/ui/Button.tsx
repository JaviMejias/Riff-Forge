import React from 'react';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth, icon, children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 rounded-xl transition-all font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:opacity-50 disabled:cursor-not-allowed";
    
    const variants = {
      primary: "bg-primary-500 hover:bg-primary-400 text-zinc-950 shadow-[0_0_15px_var(--theme-glow)]",
      secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-white/5",
      ghost: "bg-transparent hover:bg-white/5 text-zinc-300 hover:text-white",
      danger: "bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20"
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2.5 text-sm",
      lg: "px-6 py-3 text-base"
    };

    const classes = twMerge(
      baseStyles,
      variants[variant],
      sizes[size],
      fullWidth && "w-full",
      className
    );

    return (
      <button ref={ref} className={classes} {...props}>
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
