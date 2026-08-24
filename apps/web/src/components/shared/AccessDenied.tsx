import React from 'react';
import { useAppContext } from '../../hooks/useContextState';
import { ShieldAlert, X } from 'lucide-react';

export function AccessDenied() {
  const { accessDeniedMessage, clearAccessDenied } = useAppContext();

  if (!accessDeniedMessage) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full animate-bounce-short">
      <div className="glass-strong border border-crimson/30 bg-surface-1/95 rounded-card p-4 shadow-xl flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-crimson/15 text-crimson flex items-center justify-center shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-crimson">
              Acceso Denegado (403)
            </h4>
            <button
              onClick={clearAccessDenied}
              className="text-text-tertiary hover:text-white p-0.5 rounded transition"
              aria-label="Cerrar alerta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed break-words">
            {accessDeniedMessage}
          </p>
        </div>
      </div>
    </div>
  );
}
