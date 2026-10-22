import { CircleDashed, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DownloadItem } from '../../types/bilibili';

type DownloadStatus = DownloadItem['status'];

const STATUS_MAP: Record<
  DownloadStatus,
  { label: string; className: string; icon: typeof CircleDashed; spin?: boolean }
> = {
  pending: {
    label: '等待中',
    className: 'bg-neutral-subtle text-muted',
    icon: CircleDashed,
  },
  downloading: {
    label: '下载中',
    className: 'bg-accent-subtle text-accent-fg',
    icon: Loader2,
    spin: true,
  },
  completed: {
    label: '已完成',
    className: 'bg-success-subtle text-success-fg',
    icon: CheckCircle2,
  },
  failed: {
    label: '失败',
    className: 'bg-danger-subtle text-danger-fg',
    icon: XCircle,
  },
};

interface StatusLabelProps {
  status: DownloadStatus;
  className?: string;
  /** 是否显示图标 */
  showIcon?: boolean;
}

/** 状态徽章：柔和底色胶囊 */
export default function StatusLabel({ status, className, showIcon = true }: StatusLabelProps) {
  const config = STATUS_MAP[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium leading-none',
        config.className,
        className,
      )}
    >
      {showIcon && (
        <Icon size={12} className={config.spin ? 'animate-spin' : undefined} aria-hidden="true" />
      )}
      {config.label}
    </span>
  );
}

export function StatusDot({ status, className }: { status: DownloadStatus; className?: string }) {
  const color =
    status === 'completed'
      ? 'bg-success'
      : status === 'downloading'
        ? 'bg-accent'
        : status === 'failed'
          ? 'bg-danger'
          : 'bg-muted';
  return <span className={cn('inline-block h-2 w-2 rounded-full', color, className)} />;
}
