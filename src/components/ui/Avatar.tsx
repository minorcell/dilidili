import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AvatarProps {
  src?: string;
  name?: string;
  className?: string;
  iconSize?: number;
}

/** 用户头像，加载失败或缺失时回退到占位图标 */
export default function Avatar({ src, name, className, iconSize = 16 }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-subtle text-muted',
        className,
      )}
      aria-label={name ? `${name} 的头像` : '用户头像'}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={name ? `${name} 的头像` : '用户头像'}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <UserRound size={iconSize} strokeWidth={1.75} aria-hidden="true" />
      )}
    </span>
  );
}
