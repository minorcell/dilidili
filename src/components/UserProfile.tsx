import { useEffect } from 'react';
import { BadgeCheck, CircleAlert, X } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import Avatar from './ui/Avatar';
import Button from './ui/Button';

interface UserProfileProps {
  onClose?: () => void;
}

export default function UserProfile({ onClose }: UserProfileProps) {
  const { userProfile, isLoggedIn } = useAppStore();

  // 支持 Esc 关闭
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isVip = userProfile?.vip_type === 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-overlay-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-profile-title"
        className="w-full max-w-lg animate-dialog-in overflow-hidden rounded-lg border border-line bg-canvas shadow-xl"
      >
        {!isLoggedIn || !userProfile ? (
          <>
            <div className="flex items-center justify-between border-b border-line bg-subtle px-4 py-3">
              <h2 id="user-profile-title" className="text-sm font-semibold text-fg">
                个人信息
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭个人信息"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-neutral-subtle hover:text-fg"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <CircleAlert size={28} className="text-muted" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-fg">用户未登录</p>
                <p className="mt-1 text-xs text-muted">请先登录哔哩哔哩账号后查看个人信息。</p>
              </div>
            </div>
            <div className="flex justify-end border-t border-line bg-subtle px-4 py-3">
              <Button onClick={onClose}>关闭</Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  src={userProfile.avatar}
                  name={userProfile.name}
                  className="h-12 w-12"
                  iconSize={20}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      id="user-profile-title"
                      className="truncate text-base font-semibold text-fg"
                    >
                      {userProfile.name}
                    </h2>
                    {isVip && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-attention/40 bg-attention-subtle px-2 py-0.5 text-xs font-medium text-attention-fg">
                        <BadgeCheck size={12} aria-hidden="true" />
                        大会员
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted">
                    UID {userProfile.mid}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="关闭个人信息"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-neutral-subtle hover:text-fg"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <dl className="divide-y divide-line text-sm">
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-muted">用户名</dt>
                <dd className="truncate font-medium text-fg">{userProfile.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-muted">用户 ID</dt>
                <dd className="font-mono text-fg">{userProfile.mid}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-muted">会员状态</dt>
                <dd className="font-medium text-fg">{isVip ? '大会员' : '普通用户'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-muted">登录状态</dt>
                <dd className="flex items-center gap-1.5 font-medium text-success-fg">
                  <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                  已登录
                </dd>
              </div>
            </dl>

            <div className="flex justify-end border-t border-line bg-subtle px-4 py-3">
              <Button onClick={onClose}>关闭</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
