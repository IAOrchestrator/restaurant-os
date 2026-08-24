import React from 'react';
import { useAppContext } from '../../hooks/useContextState';
import { LogOut, User, Tablet, Users, Shield } from 'lucide-react';

interface HeaderProps {
  connected: boolean;
}

export function Header({ connected }: HeaderProps) {
  const { session, isAuthenticated, logout } = useAppContext();

  const getActorIcon = () => {
    if (!session) return <User className="w-3.5 h-3.5" />;
    if (session.actor.type === 'TABLE_DEVICE') return <Tablet className="w-3.5 h-3.5" />;
    if (session.actor.roles?.includes('ADMIN')) return <Shield className="w-3.5 h-3.5" />;
    return <Users className="w-3.5 h-3.5" />;
  };

  const getRoleLabel = () => {
    if (!session) return 'No autenticado';
    if (session.actor.type === 'TABLE_DEVICE') return 'Terminal Tablet';
    if (session.actor.type === 'CUSTOMER') return 'Comensal';
    const primaryRole = session.actor.roles?.[0] || 'STAFF';
    switch (primaryRole) {
      case 'ADMIN': return 'Administrador';
      case 'RECEPTIONIST': return 'Recepción';
      case 'WAITER': return 'Mozo';
      case 'KITCHEN': return 'Cocina';
      case 'CASHIER': return 'Caja';
      default: return primaryRole;
    }
  };

  return (
    <header className="sticky top-0 z-50 glass-strong border-b border-white/5 px-5 h-[64px] flex items-center justify-between shadow-card">
      {/* Brand area */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-sm bg-amber text-black flex items-center justify-center font-bold text-sm shadow-glowAmber">
          R
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-tight text-text-primary">Restaurant OS</span>
          <span className="text-[10px] tracking-widest text-text-tertiary font-mono font-semibold uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
            v0.1.0
          </span>
        </div>
      </div>

      {/* Header controls & Identity status */}
      <div className="flex items-center gap-3">
        {isAuthenticated && session ? (
          <>
            {/* Authenticated Actor Profile Badge */}
            <div className="flex items-center gap-2.5 bg-surface-1 border border-white/5 rounded-pill px-3.5 py-1.5 text-xs shadow-sm">
              <div className="w-6 h-6 rounded-full bg-amber/15 text-amber flex items-center justify-center">
                {getActorIcon()}
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-bold text-text-primary text-[12px]">
                    {session.actor.name || session.actor.email || session.actor.id.slice(0, 8)}
                  </span>
                  <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-amber/15 text-amber border border-amber/20">
                    {getRoleLabel()}
                  </span>
                </div>
                <span className="text-[10px] text-text-tertiary font-mono leading-none mt-1">
                  Restaurante: {session.actor.restaurantId.slice(0, 8)}...
                </span>
              </div>
            </div>

            {/* SSE Status */}
            <div
              className={`flex items-center gap-1.5 px-3 h-7 rounded-pill text-[11px] font-bold font-mono border transition ${
                connected
                  ? 'bg-emerald/15 border-emerald/30 text-emerald'
                  : 'bg-white/5 border-white/10 text-text-tertiary'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald animate-pulse' : 'bg-text-tertiary'}`} />
              <span>{connected ? 'LIVE SSE' : 'OFFLINE'}</span>
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-surface-2 hover:bg-crimson/15 hover:text-crimson border border-white/10 hover:border-crimson/30 text-text-secondary text-xs font-semibold transition active:scale-95 cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 h-7 rounded-pill text-[11px] font-bold font-mono bg-white/5 border border-white/10 text-text-tertiary">
              <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary" />
              <span>DESCONECTADO</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
