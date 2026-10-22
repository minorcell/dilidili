import { useId } from 'react';
import { cn } from '../../lib/utils';

interface LogoProps {
  className?: string;
}

/** DILIDILI 标志：下载箭头 + 进度环 */
export default function Logo({ className }: LogoProps) {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 1024 1024"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="DILIDILI"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="140"
          y1="100"
          x2="884"
          y2="924"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FB7299" />
          <stop offset="1" stopColor="#FF9DB9" />
        </linearGradient>
      </defs>

      <rect x="64" y="64" width="896" height="896" rx="210" fill={`url(#${gradientId})`} />

      <circle
        cx="512"
        cy="512"
        r="230"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.34"
        strokeWidth="60"
        strokeLinecap="round"
        strokeDasharray="1084 1445"
        transform="rotate(-90 512 512)"
      />

      <path d="M512 380v238" stroke="#FFFFFF" strokeWidth="88" strokeLinecap="round" />
      <path
        d="M426 528l86 94 86-94"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="88"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
