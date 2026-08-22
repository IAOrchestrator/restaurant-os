import React from 'react';
import type { Workspace } from '../../types/workspace';
import { WORKSPACE_CONFIGS } from '../../types/workspace';

interface WorkspaceLayoutProps {
  workspace: Workspace;
  children?: React.ReactNode;
}

export function WorkspaceLayout({ workspace, children }: WorkspaceLayoutProps) {
  const config = WORKSPACE_CONFIGS[workspace];

  return (
    <div className="workspace" data-workspace={workspace}>
      <header className="workspace-header">
        <h1>{config.label}</h1>
      </header>
      <main className="workspace-main">
        {children}
      </main>
    </div>
  );
}
