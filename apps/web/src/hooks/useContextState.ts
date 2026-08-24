import { createContext, useContext } from 'react';
import type { Workspace } from '../types/workspace';

export type ActorType = 'STAFF' | 'CUSTOMER' | 'TABLE_DEVICE';
export type StaffRole = 'ADMIN' | 'RECEPTIONIST' | 'WAITER' | 'KITCHEN' | 'CASHIER';

export interface AuthActor {
  id: string;
  type: ActorType;
  restaurantId: string;
  name?: string;
  email?: string;
  roles?: StaffRole[];
  tableId?: string;
  tableSessionId?: string;
}

export interface AuthSession {
  token: string;
  actor: AuthActor;
}

export interface StaffLoginInput {
  restaurantId: string;
  email?: string;
  staffId?: string;
  password?: string;
  pin?: string;
}

export interface DeviceAuthInput {
  restaurantId: string;
  deviceId: string;
  deviceSecret: string;
}

export interface CustomerSessionInput {
  restaurantId: string;
  customerId?: string;
  tableSessionId?: string;
  name?: string;
}

export interface AppContextValue {
  session: AuthSession | null;
  isAuthenticated: boolean;
  restaurantId: string;
  actorType: ActorType;
  actorId: string;
  staffRole?: StaffRole;
  authToken: string | null;
  activeWorkspace: Workspace;
  setActiveWorkspace: (ws: Workspace) => void;
  selectedTableSessionId: string | null;
  setSelectedTableSessionId: (id: string | null) => void;
  loginStaff: (input: StaffLoginInput) => Promise<{ success: boolean; error?: string }>;
  loginTableDevice: (input: DeviceAuthInput) => Promise<{ success: boolean; error?: string }>;
  loginCustomerSession: (input: CustomerSessionInput) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  accessDeniedMessage: string | null;
  setAccessDeniedMessage: (msg: string | null) => void;
  clearAccessDenied: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
}
