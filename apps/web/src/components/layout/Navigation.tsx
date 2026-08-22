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
} from '../../hooks/useContextState';
import { type Workspace } from '../../types/workspace';
import {
  Activity,
  MapPin,
  Utensils,
  ChefHat,
  Tablet,
  User,
  CreditCard,
  Sliders,
} from 'lucide-react';

const WORKSPACE_TABS: Array<{ id: Workspace; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'reception', label: 'Recepción & Mesas', icon: MapPin },
  { id: 'waiter', label: 'Mozo / Comandas', icon: Utensils },
  { id: 'kitchen', label: 'Cocina (KDS)', icon: ChefHat },
  { id: 'table', label: 'Mesa (Tablet)', icon: Tablet },
  { id: 'customer', label: 'Cliente (Móvil)', icon: User },
  { id: 'cashier', label: 'Caja & Facturación', icon: CreditCard },
  { id: 'admin', label: 'Administración', icon: Sliders },
];

export function Navigation() {
  const {
    activeWorkspace,
    setActiveWorkspace,
    setActorType,
    setStaffRole,
    setActorId,
  } = useAppContext();

  const handleTabClick = (ws: Workspace) => {
    setActiveWorkspace(ws);
    switch (ws) {
      case 'dashboard':
        setActorType('STAFF');
        setStaffRole('ADMIN');
        setActorId(DEFAULT_ADMIN_ID);
        break;
      case 'reception':
        setActorType('STAFF');
        setStaffRole('RECEPTIONIST');
        setActorId(DEFAULT_RECEPTIONIST_ID);
        break;
      case 'waiter':
        setActorType('STAFF');
        setStaffRole('WAITER');
        setActorId(DEFAULT_WAITER_ID);
        break;
      case 'kitchen':
        setActorType('STAFF');
        setStaffRole('KITCHEN');
        setActorId(DEFAULT_KITCHEN_ID);
        break;
      case 'cashier':
        setActorType('STAFF');
        setStaffRole('CASHIER');
        setActorId(DEFAULT_CASHIER_ID);
        break;
      case 'admin':
        setActorType('STAFF');
        setStaffRole('ADMIN');
        setActorId(DEFAULT_ADMIN_ID);
        break;
      case 'table':
        setActorType('TABLE_DEVICE');
        setActorId(DEFAULT_TABLE_DEVICE_ID);
        break;
      case 'customer':
        setActorType('CUSTOMER');
        setActorId(DEFAULT_CUSTOMER_ID);
        break;
    }
  };

  return (
    <nav
      className="glass sticky top-[64px] z-40 px-3 py-2 border-b border-white/5 overflow-x-auto scrollbar-none flex items-center gap-1.5 justify-start md:justify-center shadow-sm"
      aria-label="Workspace navigation"
    >
      {WORKSPACE_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeWorkspace === tab.id;
        return (
          <button
            key={tab.id}
            className={`shrink-0 h-9 px-3 rounded-pill text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 ${
              isActive
                ? 'bg-amber text-black shadow-glowAmber font-bold'
                : 'text-text-secondary hover:text-white hover:bg-white/5'
            }`}
            onClick={() => handleTabClick(tab.id)}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
