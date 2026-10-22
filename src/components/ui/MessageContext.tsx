import React, { useCallback, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  MessageContext,
  useMessage,
  type MessageContextType,
  type MessageProps,
  type MessageState,
  type MessageType,
} from './message-context';

const TONES: Record<MessageType, { icon: LucideIcon; iconClassName: string }> = {
  success: { icon: CheckCircle2, iconClassName: 'text-success-fg' },
  error: { icon: XCircle, iconClassName: 'text-danger-fg' },
  warning: { icon: AlertTriangle, iconClassName: 'text-attention-fg' },
  info: { icon: Info, iconClassName: 'text-accent-fg' },
};

interface MessageProviderProps {
  children: ReactNode;
}

export const MessageProvider: React.FC<MessageProviderProps> = ({ children }) => {
  const [messages, setMessages] = useState<MessageState[]>([]);

  const hideMessage = useCallback((id: string) => {
    setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, isVisible: false } : msg)));

    // 动画结束后移除
    setTimeout(() => {
      setMessages((prev) => prev.filter((msg) => msg.id !== id));
    }, 200);
  }, []);

  const showMessage = useCallback(
    ({ duration = 4000, ...props }: MessageProps): string => {
      const id = `${Date.now()}${Math.random().toString(36).slice(2, 9)}`;
      const newMessage: MessageState = {
        ...props,
        id,
        isVisible: true,
        duration,
      };

      setMessages((prev) => [...prev, newMessage]);

      // 自动关闭
      if (duration > 0) {
        setTimeout(() => {
          hideMessage(id);
        }, duration);
      }

      return id;
    },
    [hideMessage],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const success = useCallback(
    (msg: string, title?: string, duration?: number) =>
      showMessage({ type: 'success', message: msg, title, duration }),
    [showMessage],
  );

  const error = useCallback(
    (msg: string, title?: string, duration?: number) =>
      showMessage({ type: 'error', message: msg, title, duration }),
    [showMessage],
  );

  const warning = useCallback(
    (msg: string, title?: string, duration?: number) =>
      showMessage({ type: 'warning', message: msg, title, duration }),
    [showMessage],
  );

  const info = useCallback(
    (msg: string, title?: string, duration?: number) =>
      showMessage({ type: 'info', message: msg, title, duration }),
    [showMessage],
  );

  const contextValue = useMemo<MessageContextType>(
    () => ({
      messages,
      showMessage,
      hideMessage,
      clearMessages,
      success,
      error,
      warning,
      info,
    }),
    [messages, showMessage, hideMessage, clearMessages, success, error, warning, info],
  );

  return (
    <MessageContext.Provider value={contextValue}>
      {children}
      <MessageContainer />
    </MessageContext.Provider>
  );
};

interface MessageItemProps {
  message: MessageState;
  onClose: (id: string) => void;
}

// 单条通知
function MessageItem({ message: msg, onClose }: MessageItemProps) {
  const tone = TONES[msg.type];
  const Icon = tone.icon;

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2.5 rounded-md border border-line bg-canvas px-3 py-2.5',
        'transition-all duration-200 ease-out',
        msg.isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
    >
      <Icon size={16} className={cn('mt-0.5 shrink-0', tone.iconClassName)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {msg.title && <p className="text-sm font-semibold text-fg">{msg.title}</p>}
        <p
          className={cn(
            'whitespace-pre-line break-words text-xs leading-relaxed',
            msg.title ? 'mt-0.5 text-muted' : 'text-fg',
          )}
        >
          {msg.message}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onClose(msg.id)}
        aria-label="关闭通知"
        className="-mr-1 -mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-neutral-subtle hover:text-fg"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

// 通知容器
function MessageContainer() {
  const { messages, hideMessage } = useMessage();

  if (messages.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[10000] flex w-full max-w-sm flex-col gap-2">
      {messages.map((msg) => (
        <div key={msg.id} className="pointer-events-auto animate-toast-in">
          <MessageItem message={msg} onClose={hideMessage} />
        </div>
      ))}
    </div>
  );
}
