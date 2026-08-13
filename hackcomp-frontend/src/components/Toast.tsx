import { useCallback, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export interface ToastState {
  message: string;
  type: 'success' | 'error';
}

/** Render a fixed-position toast banner. Drop this anywhere in your page's JSX. */
export const ToastBanner = ({ toast }: { toast: ToastState | null }) => {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`alert ${toast.type === 'success' ? 'alert-success' : 'alert-danger'} fade-in`}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        minWidth: '260px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      {toast.type === 'success'
        ? <CheckCircle size={16} style={{ flexShrink: 0 }} />
        : <XCircle size={16} style={{ flexShrink: 0 }} />}
      {toast.message}
    </div>
  );
};

const TOAST_DURATION_MS = 3500;

/** Hook: returns [toast state, show(message, type)] */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  return [toast, showToast] as const;
}
