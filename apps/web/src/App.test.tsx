/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import App from './App';

const MOCK_RESTAURANT = 'a0000000-0000-0000-0000-000000000001';
const MOCK_ADMIN_ID = '90000000-0000-0000-0000-000000000002';

beforeEach(() => {
  window.sessionStorage.clear();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => [],
  });
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('Restaurant OS Web App & Workspaces', () => {
  it('renders application header and login form when unauthenticated', () => {
    render(<App />);
    expect(screen.getAllByText('Restaurant OS').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it('renders workspace navigation and switches between allowed workspaces for authenticated Admin', async () => {
    const adminSession = {
      token: 'admin.jwt.token',
      actor: {
        id: MOCK_ADMIN_ID,
        type: 'STAFF',
        restaurantId: MOCK_RESTAURANT,
        name: 'Administrador General',
        roles: ['ADMIN'],
      },
    };
    window.sessionStorage.setItem('restaurant_os_auth_session', JSON.stringify(adminSession));

    render(<App />);

    expect(screen.getByText('Administrador General')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Recepción & Mesas')).toBeInTheDocument();
    expect(screen.getByText('Mozo / Comandas')).toBeInTheDocument();
    expect(screen.getByText('Cocina (KDS)')).toBeInTheDocument();
    expect(screen.getByText('Caja & Facturación')).toBeInTheDocument();
    expect(screen.getByText('Administración')).toBeInTheDocument();

    // Switch to Dashboard
    const dashboardTab = screen.getByText('Dashboard');
    fireEvent.click(dashboardTab);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Dashboard Operativo en Vivo/i })).toBeInTheDocument();
    });

    // Switch to Cocina (KDS)
    const kitchenTab = screen.getByText('Cocina (KDS)');
    fireEvent.click(kitchenTab);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Cocina/i })).toBeInTheDocument();
    });

    // Switch to Mozo
    const waiterTab = screen.getByText('Mozo / Comandas');
    fireEvent.click(waiterTab);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Mozo/i })).toBeInTheDocument();
    });

    // Switch to Caja
    const cashierTab = screen.getByText('Caja & Facturación');
    fireEvent.click(cashierTab);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Caja & Facturación/i })).toBeInTheDocument();
    });

    // Switch to Admin
    const adminTab = screen.getByText('Administración');
    fireEvent.click(adminTab);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Administración/i })).toBeInTheDocument();
    });
  });
});
