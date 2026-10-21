import { createContext, useContext } from 'react';

export type MessageType = 'success' | 'error' | 'warning' | 'info';

export interface MessageProps {
  type: MessageType;
  title?: string;
  message: string;
  duration?: number;
}

export interface MessageState extends MessageProps {
  id: string;
  isVisible: boolean;
}

export interface MessageContextType {
  messages: MessageState[];
  showMessage: (props: MessageProps) => string;
  hideMessage: (id: string) => void;
  clearMessages: () => void;
  success: (msg: string, title?: string, duration?: number) => string;
  error: (msg: string, title?: string, duration?: number) => string;
  warning: (msg: string, title?: string, duration?: number) => string;
  info: (msg: string, title?: string, duration?: number) => string;
}

export const MessageContext = createContext<MessageContextType | undefined>(undefined);

export const useMessage = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessage must be used within a MessageProvider');
  }
  return context;
};
