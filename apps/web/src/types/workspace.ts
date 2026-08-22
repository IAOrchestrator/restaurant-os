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
  allowedEventTypes: string[];
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
    allowedEventTypes: ['CUSTOMER_CALLED', 'CUSTOMER_CONFIRMED', 'ORDER_READY', 'PAYMENT_REGISTERED', 'ORDER_UPDATED', 'TABLE_SESSION_CHANGED'],
  },
  table: {
    id: 'table',
    label: 'Mesa',
    icon: 'Tablet',
    defaultRoute: '/table',
    allowedEventTypes: ['ORDER_UPDATED', 'ORDER_READY', 'ORDER_DELIVERED', 'TABLE_SESSION_CHANGED', 'ACCOUNT_REQUESTED', 'PAYMENT_REGISTERED'],
  },
  reception: {
    id: 'reception',
    label: 'Recepción',
    icon: 'ClipboardList',
    defaultRoute: '/reception',
    allowedEventTypes: ['CUSTOMER_JOINED_WAITLIST', 'TABLE_ASSIGNED', 'TABLE_RELEASED', 'CUSTOMER_SEATED'],
  },
  waiter: {
    id: 'waiter',
    label: 'Mozo',
    icon: 'Utensils',
    defaultRoute: '/waiter',
    allowedEventTypes: ['ORDER_SENT_TO_KITCHEN', 'ORDER_READY', 'ORDER_DELIVERED', 'SERVICE_TASK_ASSIGNED'],
  },
  kitchen: {
    id: 'kitchen',
    label: 'Cocina',
    icon: 'ChefHat',
    defaultRoute: '/kitchen',
    allowedEventTypes: ['ORDER_SENT_TO_KITCHEN', 'KITCHEN_STARTED', 'ORDER_NEARLY_READY', 'ORDER_READY'],
  },
  cashier: {
    id: 'cashier',
    label: 'Caja',
    icon: 'DollarSign',
    defaultRoute: '/cashier',
    allowedEventTypes: ['ACCOUNT_REQUESTED', 'PAYMENT_REGISTERED', 'TABLE_CLOSED'],
  },
  admin: {
    id: 'admin',
    label: 'Administración',
    icon: 'Settings',
    defaultRoute: '/admin',
    allowedEventTypes: ['*'],
  },
};
