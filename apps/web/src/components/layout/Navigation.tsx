import React from 'react';
import { useAppContext } from '../../hooks/useContextState';
import { type Workspace } from '../../types/workspace';
import { isWorkspaceAllowed } from '../../workspaces/registry';
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
    actorType,
    staffRole,
    isAuthenticated,
  } = useAppContext();

  if (!isAuthenticated) {
    return null;
  }

  const allowedTabs = WORKSPACE_TABS.filter((tab) =>
    isWorkspaceAllowed(tab.id, actorType, staffRole),
  );

  if (allowedTabs.length === 0) {
    return null;
  }

  return (
    <nav
      className="glass sticky top-[64px] z-40 px-3 py-2 border-b border-white/5 overflow-x-auto scrollbar-none flex items-center gap-1.5 justify-start md:justify-center shadow-sm"
      aria-label="Workspace navigation"
    >
      {allowedTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeWorkspace === tab.id;
        return (
          <button
            key={tab.id}
            className={`shrink-0 h-9 px-3 rounded-pill text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
              isActive
                ? 'bg-amber text-black shadow-glowAmber font-bold'
                : 'text-text-secondary hover:text-white hover:bg-white/5'
            }`}
            onClick={() => setActiveWorkspace(tab.id)}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
