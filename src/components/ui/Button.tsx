import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  [
    'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md border',
    'text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
    'disabled:pointer-events-none disabled:opacity-60',
  ],
  {
    variants: {
      variant: {
        // GitHub 默认按钮：浅灰底 + 边框
        default: 'border-line bg-subtle text-fg hover:bg-neutral-subtle',
        // GitHub 主按钮：绿色
        primary: 'border-transparent bg-success text-white hover:bg-success/90',
        // 白底按钮
        outline: 'border-line bg-canvas text-fg hover:bg-subtle',
        ghost: 'border-transparent bg-transparent text-muted hover:bg-neutral-subtle hover:text-fg',
        danger:
          'border-line bg-subtle text-danger-fg hover:border-danger hover:bg-danger hover:text-white',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-8 px-3',
        lg: 'h-9 px-4',
        icon: 'h-7 w-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);

Button.displayName = 'Button';

export default Button;
