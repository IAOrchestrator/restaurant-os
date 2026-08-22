import React from 'react';
import type { Workspace } from '../../types/workspace';

interface WorkspaceGuardProps {
  workspace: Workspace;
  actorType: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const WORKSPACE_ACTOR_MAP: Record<Workspace, string[]> = {
  dashboard: ['STAFF'],
  customer: ['CUSTOMER'],
  table: ['TABLE_DEVICE'],
  reception: ['STAFF'],
  waiter: ['STAFF'],
  kitchen: ['STAFF'],
  cashier: ['STAFF'],
  admin: ['STAFF'],
};

export function WorkspaceGuard({ workspace, actorType, children, fallback }: WorkspaceGuardProps) {
  const allowed = WORKSPACE_ACTOR_MAP[workspace].includes(actorType);
  if (!allowed) {
    return <>{fallback ?? <div>Acceso no autorizado</div>}</>;
  }
  return <>{children}</>;
}
