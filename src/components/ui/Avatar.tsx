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

  // B 站图床使用 http 协议返回，统一升级为 https
  const imageSrc = src?.replace(/^http:\/\//i, 'https://');

  useEffect(() => {
    setFailed(false);
  }, [imageSrc]);

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-accent-subtle text-accent-fg',
        className,
      )}
      aria-label={name ? `${name} 的头像` : '用户头像'}
    >
      {imageSrc && !failed ? (
        <img
          src={imageSrc}
          alt={name ? `${name} 的头像` : '用户头像'}
          className="absolute inset-0 h-full w-full object-cover"
          // B 站图床会拒绝带有非 B 站 Referer 的请求，置空才能正常加载
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <UserRound size={iconSize} strokeWidth={1.75} aria-hidden="true" />
      )}
    </span>
  );
}
