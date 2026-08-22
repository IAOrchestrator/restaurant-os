import React, { useState, useEffect } from 'react';
import {
  AppContext,
  DEFAULT_RESTAURANT_ID,
  DEFAULT_ADMIN_ID,
  type ActorType,
  type StaffRole,
} from './hooks/useContextState';
import { useSse } from './hooks/useSse';
import type { Workspace } from './types/workspace';
import { Header } from './components/layout/Header';
import { Navigation } from './components/layout/Navigation';
import { WORKSPACES_REGISTRY } from './workspaces';

function App() {
  const [restaurantId, setRestaurantId] = useState<string>(DEFAULT_RESTAURANT_ID);
  const [actorType, setActorType] = useState<ActorType>('STAFF');
  const [actorId, setActorId] = useState<string>(DEFAULT_ADMIN_ID);
  const [staffRole, setStaffRole] = useState<StaffRole>('ADMIN');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>('reception');
  const [selectedTableSessionId, setSelectedTableSessionId] = useState<string | null>(null);

  // Sync token whenever identity changes
  useEffect(() => {
    async function syncAuthToken() {
      try {
        let endpoint = '/api/auth/staff-login';
        let body: any = { restaurantId, staffId: actorId };

        if (actorType === 'TABLE_DEVICE') {
          endpoint = '/api/auth/device-auth';
          body = { restaurantId, deviceId: actorId };
        } else if (actorType === 'CUSTOMER') {
          endpoint = '/api/auth/customer-session-token';
          body = { restaurantId, customerId: actorId, tableSessionId: selectedTableSessionId || undefined };
        }

        const origin = typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null' ? window.location.origin : 'http://localhost:3000';
        const url = `${origin}${endpoint}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            setAuthToken(data.token);
          }
        }
      } catch {
        // Suppress network errors in disconnected / test environments
      }
    }

    syncAuthToken();
  }, [restaurantId, actorType, actorId, selectedTableSessionId]);

  const { connected } = useSse(activeWorkspace, restaurantId, selectedTableSessionId ?? undefined, authToken);

  const contextValue = {
    restaurantId,
    setRestaurantId,
    actorType,
    setActorType,
    actorId,
    setActorId,
    staffRole,
    setStaffRole,
    authToken,
    setAuthToken,
    activeWorkspace,
    setActiveWorkspace,
    selectedTableSessionId,
    setSelectedTableSessionId,
  };

  const renderActiveWorkspace = () => {
    const workspaceDef = WORKSPACES_REGISTRY[activeWorkspace];
    if (workspaceDef) {
      const Component = workspaceDef.Component;
      return <Component />;
    }
    const DefaultComponent = WORKSPACES_REGISTRY.reception.Component;
    return <DefaultComponent />;
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="app-shell">
        <Header connected={connected} />
        <Navigation />
        <main className="workspace-content">
          {renderActiveWorkspace()}
        </main>
      </div>
    </AppContext.Provider>
  );
}

export default App;
