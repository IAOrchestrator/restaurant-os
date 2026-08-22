import React from 'react';
import {
  useAppContext,
  DEFAULT_ADMIN_ID,
  DEFAULT_WAITER_ID,
  DEFAULT_RECEPTIONIST_ID,
  DEFAULT_KITCHEN_ID,
  DEFAULT_CASHIER_ID,
  DEFAULT_CUSTOMER_ID,
  DEFAULT_TABLE_DEVICE_ID,
  type ActorType,
  type StaffRole,
} from '../../hooks/useContextState';

interface HeaderProps {
  connected: boolean;
}

export function Header({ connected }: HeaderProps) {
  const {
    actorType,
    setActorType,
    actorId,
    setActorId,
    staffRole,
    setStaffRole,
  } = useAppContext();

  const handleRoleChange = (role: StaffRole) => {
    setStaffRole(role);
    setActorType('STAFF');
    if (role === 'ADMIN') setActorId(DEFAULT_ADMIN_ID);
    else if (role === 'WAITER') setActorId(DEFAULT_WAITER_ID);
    else if (role === 'RECEPTIONIST') setActorId(DEFAULT_RECEPTIONIST_ID);
    else if (role === 'KITCHEN') setActorId(DEFAULT_KITCHEN_ID);
    else if (role === 'CASHIER') setActorId(DEFAULT_CASHIER_ID);
    else setActorId(DEFAULT_ADMIN_ID);
  };

  const handleActorTypeChange = (type: ActorType) => {
    setActorType(type);
    if (type === 'CUSTOMER') {
      setActorId(DEFAULT_CUSTOMER_ID);
    } else if (type === 'TABLE_DEVICE') {
      setActorId(DEFAULT_TABLE_DEVICE_ID);
    } else {
      handleRoleChange(staffRole);
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

      {/* Header controls & Identity switcher */}
      <div className="flex items-center gap-3">
        {/* Actor Selector */}
        <div className="hidden sm:flex items-center gap-2 bg-surface-1 border border-white/5 rounded-pill px-3 py-1.5 text-xs">
          <span className="text-[11px] font-bold text-text-tertiary uppercase">Actor:</span>
          <select
            className="bg-transparent font-bold text-text-primary focus:outline-none cursor-pointer text-xs"
            value={actorType}
            onChange={(e) => handleActorTypeChange(e.target.value as ActorType)}
          >
            <option value="STAFF" className="bg-surface-2 text-text-primary">Personal (Staff)</option>
            <option value="TABLE_DEVICE" className="bg-surface-2 text-text-primary">Tablet Mesa (Device)</option>
            <option value="CUSTOMER" className="bg-surface-2 text-text-primary">Cliente (Móvil)</option>
          </select>
        </div>

        {/* Staff Role Selector */}
        {actorType === 'STAFF' && (
          <div className="hidden sm:flex items-center gap-2 bg-surface-1 border border-white/5 rounded-pill px-3 py-1.5 text-xs">
            <span className="text-[11px] font-bold text-text-tertiary uppercase">Rol:</span>
            <select
              className="bg-transparent font-bold text-amber focus:outline-none cursor-pointer text-xs"
              value={staffRole}
              onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
            >
              <option value="ADMIN" className="bg-surface-2 text-text-primary">Admin</option>
              <option value="RECEPTIONIST" className="bg-surface-2 text-text-primary">Recepción</option>
              <option value="WAITER" className="bg-surface-2 text-text-primary">Mozo</option>
              <option value="KITCHEN" className="bg-surface-2 text-text-primary">Cocina</option>
              <option value="CASHIER" className="bg-surface-2 text-text-primary">Caja</option>
            </select>
          </div>
        )}

        {/* SSE Realtime Status Badge */}
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
      </div>
    </header>
  );
}
