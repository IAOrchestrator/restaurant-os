import React, { useState, useEffect, useCallback } from 'react';
import {
  AppContext,
  type AuthSession,
  type ActorType,
  type StaffRole,
  type StaffLoginInput,
  type DeviceAuthInput,
  type CustomerSessionInput,
} from './hooks/useContextState';
import { useSse } from './hooks/useSse';
import type { Workspace } from './types/workspace';
import { Header } from './components/layout/Header';
import { Navigation } from './components/layout/Navigation';
import { LoginForm } from './components/auth/LoginForm';
import { AccessDenied } from './components/shared/AccessDenied';
import { WORKSPACES_REGISTRY, isWorkspaceAllowed, getAllowedWorkspaces } from './workspaces';

const SESSION_STORAGE_KEY = 'restaurant_os_auth_session';

function getInitialSession(): AuthSession | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function App() {
  const [session, setSession] = useState<AuthSession | null>(getInitialSession);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>('reception');
  const [selectedTableSessionId, setSelectedTableSessionId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  const isAuthenticated = !!session?.token;
  const restaurantId = session?.actor.restaurantId ?? 'a0000000-0000-0000-0000-000000000001';
  const actorType: ActorType = session?.actor.type ?? 'STAFF';
  const actorId = session?.actor.id ?? '';
  const staffRole: StaffRole | undefined = session?.actor.roles?.[0];
  const authToken = session?.token ?? null;

  // Persist session changes
  const saveSession = useCallback((newSession: AuthSession | null) => {
    setSession(newSession);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (newSession) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
      } else {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  }, []);

  const logout = useCallback(() => {
    saveSession(null);
    setAuthError(null);
    setAccessDeniedMessage(null);
    setActiveWorkspace('reception');
  }, [saveSession]);

  const clearAccessDenied = useCallback(() => {
    setAccessDeniedMessage(null);
  }, []);

  const loginStaff = useCallback(
    async (input: StaffLoginInput): Promise<{ success: boolean; error?: string }> => {
      try {
        const baseUrl =
          typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL
            ? import.meta.env.VITE_API_URL
            : '';
        const url = `${baseUrl}/api/auth/staff-login`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        const data = await res.json();
        if (!res.ok) {
          const errMsg = data?.error || 'Credenciales inválidas o no autorizadas';
          setAuthError(errMsg);
          return { success: false, error: errMsg };
        }

        const newSession: AuthSession = {
          token: data.token,
          actor: data.actor,
        };
        saveSession(newSession);
        setAuthError(null);

        // Auto-select initial workspace suitable for primary role
        const primaryRole = data.actor.roles?.[0];
        if (primaryRole === 'WAITER') setActiveWorkspace('waiter');
        else if (primaryRole === 'KITCHEN') setActiveWorkspace('kitchen');
        else if (primaryRole === 'RECEPTIONIST') setActiveWorkspace('reception');
        else if (primaryRole === 'CASHIER') setActiveWorkspace('cashier');
        else setActiveWorkspace('dashboard');

        return { success: true };
      } catch (err: any) {
        const msg = err.message || 'Error de conexión con el servidor de autenticación';
        setAuthError(msg);
        return { success: false, error: msg };
      }
    },
    [saveSession],
  );

  const loginTableDevice = useCallback(
    async (input: DeviceAuthInput): Promise<{ success: boolean; error?: string }> => {
      try {
        const baseUrl =
          typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL
            ? import.meta.env.VITE_API_URL
            : '';
        const url = `${baseUrl}/api/auth/device-auth`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        const data = await res.json();
        if (!res.ok) {
          const errMsg = data?.error || 'Credenciales de dispositivo inválidas';
          setAuthError(errMsg);
          return { success: false, error: errMsg };
        }

        const newSession: AuthSession = {
          token: data.token,
          actor: data.actor,
        };
        saveSession(newSession);
        setAuthError(null);
        setActiveWorkspace('table');

        return { success: true };
      } catch (err: any) {
        const msg = err.message || 'Error de conexión con el servidor de autenticación';
        setAuthError(msg);
        return { success: false, error: msg };
      }
    },
    [saveSession],
  );

  const loginCustomerSession = useCallback(
    async (input: CustomerSessionInput): Promise<{ success: boolean; error?: string }> => {
      try {
        const baseUrl =
          typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL
            ? import.meta.env.VITE_API_URL
            : '';
        const url = `${baseUrl}/api/auth/customer-session-token`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        const data = await res.json();
        if (!res.ok) {
          const errMsg = data?.error || 'Error al iniciar sesión de comensal';
          setAuthError(errMsg);
          return { success: false, error: errMsg };
        }

        const newSession: AuthSession = {
          token: data.token,
          actor: data.actor,
        };
        saveSession(newSession);
        setAuthError(null);
        if (input.tableSessionId) {
          setSelectedTableSessionId(input.tableSessionId);
        }
        setActiveWorkspace('customer');

        return { success: true };
      } catch (err: any) {
        const msg = err.message || 'Error de conexión con el servidor de autenticación';
        setAuthError(msg);
        return { success: false, error: msg };
      }
    },
    [saveSession],
  );

  // Validate active workspace against current permissions
  useEffect(() => {
    if (isAuthenticated) {
      const allowed = isWorkspaceAllowed(activeWorkspace, actorType, staffRole);
      if (!allowed) {
        const allowedList = getAllowedWorkspaces(actorType, staffRole);
        if (allowedList.length > 0) {
          setActiveWorkspace(allowedList[0].id);
        }
      }
    }
  }, [isAuthenticated, activeWorkspace, actorType, staffRole]);

  const { connected } = useSse(activeWorkspace, restaurantId, selectedTableSessionId ?? undefined, authToken);

  const contextValue = {
    session,
    isAuthenticated,
    restaurantId,
    actorType,
    actorId,
    staffRole,
    authToken,
    activeWorkspace,
    setActiveWorkspace,
    selectedTableSessionId,
    setSelectedTableSessionId,
    loginStaff,
    loginTableDevice,
    loginCustomerSession,
    logout,
    authError,
    setAuthError,
    accessDeniedMessage,
    setAccessDeniedMessage,
    clearAccessDenied,
  };

  const renderContent = () => {
    if (!isAuthenticated) {
      return <LoginForm />;
    }

    const isAllowed = isWorkspaceAllowed(activeWorkspace, actorType, staffRole);
    if (!isAllowed) {
      return (
        <div className="p-8 text-center">
          <h3 className="text-lg font-bold text-crimson mb-2">Acceso No Autorizado</h3>
          <p className="text-xs text-text-secondary">
            Su perfil no cuenta con permisos para operar en el espacio de trabajo "{activeWorkspace}".
          </p>
        </div>
      );
    }

    const workspaceDef = WORKSPACES_REGISTRY[activeWorkspace];
    if (workspaceDef) {
      const Component = workspaceDef.Component;
      return <Component />;
    }

    return null;
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="app-shell min-h-screen flex flex-col">
        <Header connected={connected} />
        {isAuthenticated && <Navigation />}
        <main className="workspace-content flex-1">
          {renderContent()}
        </main>
        <AccessDenied />
      </div>
    </AppContext.Provider>
  );
}

export default App;
