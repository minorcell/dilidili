import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  [
    'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border',
    'font-medium transition-all duration-200 active:scale-[0.98]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        // 次要按钮：白底细边框
        default: 'border-line bg-canvas text-fg hover:border-accent/40 hover:bg-accent-subtle hover:text-accent-fg',
        // 主按钮：品牌粉
        primary:
          'border-transparent bg-accent text-white shadow-[0_2px_10px_rgba(251,114,153,0.35)] hover:bg-[#fc8bab] hover:shadow-[0_4px_14px_rgba(251,114,153,0.45)]',
        // 描边按钮
        outline: 'border-line bg-transparent text-fg hover:bg-subtle',
        ghost: 'border-transparent bg-transparent text-muted hover:bg-neutral-subtle hover:text-fg',
        danger:
          'border-transparent bg-danger-subtle text-danger-fg hover:bg-danger hover:text-white',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4',
        lg: 'h-11 px-6 text-[15px]',
        icon: 'h-8 w-8',
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
