import React from 'react';
import type { Workspace } from '../types/workspace';
import type { ActorType, StaffRole } from '../hooks/useContextState';
import type { EventType } from '@restaurant-os/contracts';

import { DashboardPage } from './dashboard/dashboard-page';
import { ReceptionPage } from './reception';
import { WaiterPage } from './waiter';
import { KitchenPage } from './kitchen';
import { TablePage } from './table';
import { CustomerPage } from './customer';
import { CashierPage } from './cashier';
import { AdminPage } from './admin';

export interface WorkspaceDefinition {
  id: Workspace;
  label: string;
  icon: string;
  description: string;
  targetActorType: ActorType;
  allowedActorTypes: ActorType[];
  allowedStaffRoles?: StaffRole[];
  allowedEventTypes: Array<EventType | '*' | string>;
  Component: React.ComponentType;
}

export const WORKSPACES_REGISTRY: Record<Workspace, WorkspaceDefinition> = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard en Vivo',
    icon: 'Activity',
    description: 'Monitor analítico gerencial en tiempo real de facturación, rotación de mesas, cocina y mozos',
    targetActorType: 'STAFF',
    allowedActorTypes: ['STAFF'],
    allowedStaffRoles: ['ADMIN'],
    allowedEventTypes: ['*'],
    Component: DashboardPage,
  },
  reception: {
    id: 'reception',
    label: 'Recepción',
    icon: 'ClipboardList',
    description: 'Gestión de fila de espera, asignación y liberación de mesas físicas',
    targetActorType: 'STAFF',
    allowedActorTypes: ['STAFF'],
    allowedStaffRoles: ['RECEPTIONIST', 'ADMIN'],
    allowedEventTypes: [
      'CUSTOMER_JOINED_WAITLIST',
      'CUSTOMER_CALLED',
      'CUSTOMER_CONFIRMED',
      'CUSTOMER_SEATED',
      'CUSTOMER_CANCELLED_WAIT',
      'CUSTOMER_SELECTED_TAKEAWAY',
      'TABLE_ASSIGNED',
      'TABLE_CHANGED',
      'TABLE_RELEASED',
      'TABLE_CLOSED',
      'ACCOUNT_CLOSED',
    ],
    Component: ReceptionPage,
  },
  waiter: {
    id: 'waiter',
    label: 'Mozo',
    icon: 'Utensils',
    description: 'Toma de comandas móvil, control de salón, atención de alertas y traspaso de mesas',
    targetActorType: 'STAFF',
    allowedActorTypes: ['STAFF'],
    allowedStaffRoles: ['WAITER', 'ADMIN', 'RECEPTIONIST'],
    allowedEventTypes: [
      'TABLE_ASSIGNED',
      'TABLE_CHANGED',
      'WAITER_CHANGED',
      'ORDER_CONFIRMED',
      'ORDER_SENT_TO_KITCHEN',
      'ORDER_NEARLY_READY',
      'ORDER_READY',
      'ORDER_DELIVERED',
      'SERVICE_TASK_CREATED',
      'TABLE_CLOSED',
      'ACCOUNT_CLOSED',
    ],
    Component: WaiterPage,
  },
  kitchen: {
    id: 'kitchen',
    label: 'Cocina (KDS)',
    icon: 'ChefHat',
    description: 'Tablero KDS de comandas en preparación, tiempos de cocción y notas de alérgenos',
    targetActorType: 'STAFF',
    allowedActorTypes: ['STAFF'],
    allowedStaffRoles: ['KITCHEN', 'ADMIN'],
    allowedEventTypes: [
      'ORDER_SENT_TO_KITCHEN',
      'KITCHEN_RECEIVED',
      'KITCHEN_STARTED',
      'ORDER_NEARLY_READY',
      'ORDER_READY',
      'ORDER_DELIVERED',
      'ORDER_CANCELLED',
      'TABLE_CHANGED',
    ],
    Component: KitchenPage,
  },
  table: {
    id: 'table',
    label: 'Tablet Mesa',
    icon: 'Tablet',
    description: 'Terminal fija de autoservicio en mesa, llamado de mozo y solicitud de cuenta',
    targetActorType: 'TABLE_DEVICE',
    allowedActorTypes: ['TABLE_DEVICE'],
    allowedStaffRoles: [],
    allowedEventTypes: [
      'TABLE_ASSIGNED',
      'ORDER_CONFIRMED',
      'ORDER_SENT_TO_KITCHEN',
      'ORDER_READY',
      'ORDER_DELIVERED',
      'SERVICE_TASK_CREATED',
      'ACCOUNT_REQUESTED',
      'PAYMENT_REGISTERED',
      'ACCOUNT_CLOSED',
      'TABLE_CLOSED',
    ],
    Component: TablePage,
  },
  customer: {
    id: 'customer',
    label: 'Cliente Móvil',
    icon: 'User',
    description: 'Carta digital para comensal, auto-pedidos, pedidos de asistencia y encuestas',
    targetActorType: 'CUSTOMER',
    allowedActorTypes: ['CUSTOMER'],
    allowedStaffRoles: [],
    allowedEventTypes: [
      'CUSTOMER_CALLED',
      'CUSTOMER_CONFIRMED',
      'CUSTOMER_SEATED',
      'ORDER_CONFIRMED',
      'ORDER_SENT_TO_KITCHEN',
      'ORDER_READY',
      'ORDER_DELIVERED',
      'SERVICE_TASK_CREATED',
      'PAYMENT_REGISTERED',
      'ACCOUNT_CLOSED',
    ],
    Component: CustomerPage,
  },
  cashier: {
    id: 'cashier',
    label: 'Caja',
    icon: 'DollarSign',
    description: 'Consolidación de cuentas, registro de pagos manuales y cierre contable',
    targetActorType: 'STAFF',
    allowedActorTypes: ['STAFF'],
    allowedStaffRoles: ['CASHIER', 'ADMIN'],
    allowedEventTypes: [
      'TABLE_ASSIGNED',
      'ORDER_DELIVERED',
      'ACCOUNT_REQUESTED',
      'PAYMENT_REGISTERED',
      'ACCOUNT_CLOSED',
      'TABLE_CLOSED',
    ],
    Component: CashierPage,
  },
  admin: {
    id: 'admin',
    label: 'Administración',
    icon: 'Settings',
    description: 'Configuración de salón, roles de personal, catálogo y auditoría de eventos',
    targetActorType: 'STAFF',
    allowedActorTypes: ['STAFF'],
    allowedStaffRoles: ['ADMIN'],
    allowedEventTypes: ['*'],
    Component: AdminPage,
  },
};

export function isWorkspaceAllowed(workspace: Workspace, actorType: ActorType, staffRole?: StaffRole): boolean {
  const def = WORKSPACES_REGISTRY[workspace];
  if (!def) return false;

  if (!def.allowedActorTypes.includes(actorType)) {
    return false;
  }

  if (actorType === 'STAFF') {
    if (!staffRole) return false;
    if (def.allowedStaffRoles && !def.allowedStaffRoles.includes(staffRole)) {
      return false;
    }
  }

  return true;
}

export function getAllowedWorkspaces(actorType: ActorType, staffRole?: StaffRole): WorkspaceDefinition[] {
  return Object.values(WORKSPACES_REGISTRY).filter((def) =>
    isWorkspaceAllowed(def.id, actorType, staffRole),
  );
}
