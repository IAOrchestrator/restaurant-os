import { createContext, useContext } from 'react';
import type { Workspace } from '../types/workspace';

export type ActorType = 'STAFF' | 'CUSTOMER' | 'TABLE_DEVICE';
export type StaffRole = 'ADMIN' | 'RECEPTIONIST' | 'WAITER' | 'KITCHEN' | 'CASHIER';

export interface AppContextValue {
  restaurantId: string;
  setRestaurantId: (id: string) => void;
  actorType: ActorType;
  setActorType: (type: ActorType) => void;
  actorId: string;
  setActorId: (id: string) => void;
  staffRole: StaffRole;
  setStaffRole: (role: StaffRole) => void;
  authToken: string | null;
  setAuthToken: (token: string | null) => void;
  activeWorkspace: Workspace;
  setActiveWorkspace: (ws: Workspace) => void;
  selectedTableSessionId: string | null;
  setSelectedTableSessionId: (id: string | null) => void;
}

export const DEFAULT_RESTAURANT_ID = 'a0000000-0000-0000-0000-000000000001';
export const DEFAULT_WAITER_ID = 'e0000000-0000-0000-0000-000000000001';
export const DEFAULT_RECEPTIONIST_ID = 'f0000000-0000-0000-0000-000000000001';
export const DEFAULT_ADMIN_ID = 'f0000000-0000-0000-0000-000000000002';
export const DEFAULT_KITCHEN_ID = 'c0000000-0000-0000-0000-000000000002';
export const DEFAULT_CASHIER_ID = 'c0000000-0000-0000-0000-000000000003';
export const DEFAULT_CUSTOMER_ID = 'd0000000-0000-0000-0000-000000000001';
export const DEFAULT_TABLE_DEVICE_ID = '90000000-0000-0000-0000-000000000001';

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
}
