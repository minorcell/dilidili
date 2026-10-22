import { Clapperboard } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LogoProps {
  className?: string;
  iconSize?: number;
  /** 兼容旧用法：logo 现在统一使用品牌样式 */
  onDark?: boolean;
}

export default function Logo({ className, iconSize = 20 }: LogoProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#fb7299] to-[#fc9db8] text-white shadow-[0_2px_10px_rgba(251,114,153,0.35)]',
        className,
      )}
    >
      <Clapperboard size={iconSize} strokeWidth={2} aria-hidden="true" />
    </div>
  );
}
