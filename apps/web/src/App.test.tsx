/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from './App';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Restaurant OS Web App & Workspaces', () => {
  it('renders application header and workspace navigation tabs', () => {
    render(<App />);
    expect(screen.getByText('Restaurant OS')).toBeInTheDocument();
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Recepción & Mesas')).toBeInTheDocument();
    expect(screen.getByText('Mozo / Comandas')).toBeInTheDocument();
    expect(screen.getByText('Cocina (KDS)')).toBeInTheDocument();
    expect(screen.getByText('Mesa (Tablet)')).toBeInTheDocument();
    expect(screen.getAllByText(/Cliente \(Móvil\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Caja & Facturación/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Administración')).toBeInTheDocument();
  });

  it('switches between workspaces on navigation click', () => {
    render(<App />);

    // Default workspace: Reception
    expect(screen.getByRole('heading', { name: /Recepción/i })).toBeInTheDocument();

    // Click Dashboard
    const dashboardTab = screen.getByText('Dashboard');
    fireEvent.click(dashboardTab);
    expect(screen.getByRole('heading', { name: /Dashboard Operativo en Vivo/i })).toBeInTheDocument();

    // Click Cocina (KDS)
    const kitchenTab = screen.getByText('Cocina (KDS)');
    fireEvent.click(kitchenTab);
    expect(screen.getByRole('heading', { name: /Cocina/i })).toBeInTheDocument();

    // Click Mesa (Tablet)
    const tableTab = screen.getByText('Mesa (Tablet)');
    fireEvent.click(tableTab);
    expect(screen.getByRole('heading', { name: /Menú Interactivo en Mesa/i })).toBeInTheDocument();

    // Click Mozo
    const waiterTab = screen.getByText('Mozo / Comandas');
    fireEvent.click(waiterTab);
    expect(screen.getByRole('heading', { name: /Mozo/i })).toBeInTheDocument();

    // Click Caja
    const cashierTab = screen.getByText('Caja & Facturación');
    fireEvent.click(cashierTab);
    expect(screen.getByRole('heading', { name: /Caja & Facturación/i })).toBeInTheDocument();

    // Click Admin
    const adminTab = screen.getByText('Administración');
    fireEvent.click(adminTab);
    expect(screen.getByRole('heading', { name: /Panel de Administración/i })).toBeInTheDocument();
  });
});
