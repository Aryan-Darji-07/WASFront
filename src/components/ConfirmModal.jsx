import React, { useEffect, useRef, createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, Trash2, LogOut, UserPlus, Edit, X, CheckCircle, Info } from 'lucide-react';

// ─── Context ──────────────────────────────────────────────────────────────────

const ConfirmContext = createContext(null);

/**
 * Wrap your app with <ConfirmProvider> once, then call useConfirm() anywhere.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: 'Delete user?',
 *     message: 'This action cannot be undone.',
 *     confirmLabel: 'Delete',
 *     variant: 'danger',   // 'danger' | 'warning' | 'info'
 *   });
 *   if (ok) { ... do the thing ... }
 */
export function ConfirmProvider({ children }) {
  const [opts, setOpts]       = useState(null);
  const resolveRef            = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setOpts(options);
    });
  }, []);

  function handleResolve(value) {
    setOpts(null);
    resolveRef.current?.(value);
    resolveRef.current = null;
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <ConfirmModal
          {...opts}
          onConfirm={() => handleResolve(true)}
          onCancel={() => handleResolve(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANTS = {
  danger: {
    icon:        <Trash2 className="w-6 h-6 text-red-500" />,
    iconBg:      'bg-red-100',
    btnClass:    'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500 text-white',
    titleColor:  'text-gray-900',
  },
  warning: {
    icon:        <AlertTriangle className="w-6 h-6 text-amber-500" />,
    iconBg:      'bg-amber-100',
    btnClass:    'bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-400 text-white',
    titleColor:  'text-gray-900',
  },
  info: {
    icon:        <Info className="w-6 h-6 text-blue-500" />,
    iconBg:      'bg-blue-100',
    btnClass:    'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500 text-white',
    titleColor:  'text-gray-900',
  },
  success: {
    icon:        <CheckCircle className="w-6 h-6 text-green-500" />,
    iconBg:      'bg-green-100',
    btnClass:    'bg-green-600 hover:bg-green-700 focus-visible:ring-green-500 text-white',
    titleColor:  'text-gray-900',
  },
  logout: {
    icon:        <LogOut className="w-6 h-6 text-red-500" />,
    iconBg:      'bg-red-100',
    btnClass:    'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500 text-white',
    titleColor:  'text-gray-900',
  },
};

// ─── Modal UI ─────────────────────────────────────────────────────────────────

function ConfirmModal({
  title         = 'Are you sure?',
  message       = '',
  confirmLabel  = 'Confirm',
  cancelLabel   = 'Cancel',
  variant       = 'danger',
  details       = null,   // optional extra detail line (JSX or string)
  onConfirm,
  onCancel,
}) {
  const cfg         = VARIANTS[variant] || VARIANTS.danger;
  const confirmRef  = useRef(null);

  // Auto-focus confirm button so Enter/Space works immediately
  useEffect(() => {
    const id = setTimeout(() => confirmRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby={message ? 'confirm-message' : undefined}
    >
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel — bottom sheet on mobile, centered card on sm+ */}
      <div className="
        relative w-full sm:max-w-md
        bg-white
        rounded-t-2xl sm:rounded-2xl
        shadow-2xl
        flex flex-col
        animate-slide-up sm:animate-scale-in
        overflow-hidden
      ">
        {/* Top bar (mobile drag handle aesthetics) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Content */}
        <div className="px-5 pt-4 pb-2 sm:px-6 sm:pt-6">
          {/* Icon + title row */}
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-11 h-11 rounded-full ${cfg.iconBg} flex items-center justify-center`}>
              {cfg.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h2
                id="confirm-title"
                className={`text-base font-bold leading-snug ${cfg.titleColor} pr-6`}
              >
                {title}
              </h2>
              {message && (
                <p
                  id="confirm-message"
                  className="mt-1.5 text-sm text-gray-500 leading-relaxed"
                >
                  {message}
                </p>
              )}
              {details && (
                <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                  {details}
                </div>
              )}
            </div>
            {/* X close */}
            <button
              onClick={onCancel}
              className="
                absolute top-3 right-3 sm:top-4 sm:right-4
                w-8 h-8 flex items-center justify-center
                rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100
                transition-colors
              "
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          <button
            onClick={onCancel}
            className="
              flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold
              bg-gray-100 hover:bg-gray-200 text-gray-700
              transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400
            "
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`
              flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold
              transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
              ${cfg.btnClass}
            `}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      {/* Animations (injected once) */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        .animate-slide-up  { animation: slide-up  0.22s cubic-bezier(0.32,0.72,0,1) both; }
        @media (min-width: 640px) {
          .sm\\:animate-scale-in { animation: scale-in 0.18s ease-out both; }
          .animate-slide-up { animation: scale-in 0.18s ease-out both; }
        }
      `}</style>
    </div>
  );
}

export default ConfirmModal;