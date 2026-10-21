import { Clapperboard } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LogoProps {
  className?: string;
  iconSize?: number;
  /** 用于深色头部背景 */
  onDark?: boolean;
}

export default function Logo({ className, iconSize = 20, onDark = false }: LogoProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md border',
        onDark ? 'border-white/20 bg-white/10 text-white' : 'border-line bg-subtle text-fg',
        className,
      )}
    >
      <Clapperboard size={iconSize} strokeWidth={1.75} aria-hidden="true" />
    </div>
  );
}
