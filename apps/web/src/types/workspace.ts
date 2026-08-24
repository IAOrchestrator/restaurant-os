import type { EventType } from '@restaurant-os/contracts';

export type Workspace =
  | 'dashboard'
  | 'customer'
  | 'table'
  | 'reception'
  | 'waiter'
  | 'kitchen'
  | 'cashier'
  | 'admin';

export interface WorkspaceConfig {
  id: Workspace;
  label: string;
  icon: string;
  defaultRoute: string;
  allowedEventTypes: Array<EventType | '*'>;
}

export const WORKSPACE_CONFIGS: Record<Workspace, WorkspaceConfig> = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'Activity',
    defaultRoute: '/dashboard',
    allowedEventTypes: ['*'],
  },
  customer: {
    id: 'customer',
    label: 'Cliente',
    icon: 'User',
    defaultRoute: '/customer',
    allowedEventTypes: [
      'CUSTOMER_CALLED',
      'CUSTOMER_CONFIRMED',
      'CUSTOMER_SEATED',
      'ORDER_CONFIRMED',
      'ORDER_SENT_TO_KITCHEN',
      'ORDER_READY',
      'ORDER_DELIVERED',
      'PAYMENT_REGISTERED',
      'ACCOUNT_CLOSED',
    ],
  },
  table: {
    id: 'table',
    label: 'Mesa',
    icon: 'Tablet',
    defaultRoute: '/table',
    allowedEventTypes: [
      'TABLE_ASSIGNED',
      'ORDER_CONFIRMED',
      'ORDER_SENT_TO_KITCHEN',
      'ORDER_READY',
      'ORDER_DELIVERED',
      'ACCOUNT_REQUESTED',
      'PAYMENT_REGISTERED',
      'ACCOUNT_CLOSED',
      'TABLE_CLOSED',
    ],
  },
  reception: {
    id: 'reception',
    label: 'Recepción',
    icon: 'ClipboardList',
    defaultRoute: '/reception',
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
  },
  waiter: {
    id: 'waiter',
    label: 'Mozo',
    icon: 'Utensils',
    defaultRoute: '/waiter',
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
  },
  kitchen: {
    id: 'kitchen',
    label: 'Cocina',
    icon: 'ChefHat',
    defaultRoute: '/kitchen',
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
  },
  cashier: {
    id: 'cashier',
    label: 'Caja',
    icon: 'DollarSign',
    defaultRoute: '/cashier',
    allowedEventTypes: [
      'TABLE_ASSIGNED',
      'ORDER_DELIVERED',
      'ACCOUNT_REQUESTED',
      'PAYMENT_REGISTERED',
      'ACCOUNT_CLOSED',
      'TABLE_CLOSED',
    ],
  },
  admin: {
    id: 'admin',
    label: 'Administración',
    icon: 'Settings',
    defaultRoute: '/admin',
    allowedEventTypes: ['*'],
  },
};
