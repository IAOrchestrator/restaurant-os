/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import App from '../App';

const MOCK_RESTAURANT = 'a0000000-0000-0000-0000-000000000001';
const MOCK_WAITER_ID = '90000000-0000-0000-0000-000000000001';
const MOCK_ADMIN_ID = '90000000-0000-0000-0000-000000000002';
const MOCK_DEVICE_ID = 'd0000000-0000-0000-0000-000000000001';
const MOCK_CUSTOMER_ID = 'f0000000-0000-0000-0000-000000000001';

describe('Step 3.5 — Frontend Authentication, Authorization & Session Management', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Unauthenticated Initial State', () => {
    it('renders LoginForm by default when no session exists', () => {
      render(<App />);
      expect(screen.getByRole('button', { name: /personal/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /tablet/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /comensal/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
    });

    it('does NOT render workspace navigation when unauthenticated', () => {
      render(<App />);
      expect(screen.queryByRole('navigation', { name: /workspace navigation/i })).not.toBeInTheDocument();
    });
  });

  describe('2. Staff Authentication (Password & PIN)', () => {
    it('2.1. Successfully logs in with password and derives actor roles', async () => {
      const mockStaffResponse = {
        token: 'mock.jwt.staff-admin-token',
        actor: {
          id: MOCK_ADMIN_ID,
          type: 'STAFF',
          restaurantId: MOCK_RESTAURANT,
          name: 'Gerente Carlos',
          email: 'admin@restaurant.com',
          roles: ['ADMIN'],
        },
      };

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/auth/staff-login')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockStaffResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => [],
        });
      });

      render(<App />);

      const emailInput = screen.getByPlaceholderText('mozo@restaurant.com');
      const passwordInput = screen.getByPlaceholderText('••••••••••••');
      const submitBtn = screen.getByRole('button', { name: /iniciar sesión/i });

      fireEvent.change(emailInput, { target: { value: 'admin@restaurant.com' } });
      fireEvent.change(passwordInput, { target: { value: 'SuperSecret123!' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Gerente Carlos')).toBeInTheDocument();
        expect(screen.getByText('Administrador')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /salir/i })).toBeInTheDocument();
      });

      // Stored in sessionStorage
      const stored = window.sessionStorage.getItem('restaurant_os_auth_session');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!).token).toBe('mock.jwt.staff-admin-token');
    });

    it('2.2. Successfully logs in with PIN', async () => {
      const mockWaiterResponse = {
        token: 'mock.jwt.waiter-token',
        actor: {
          id: MOCK_WAITER_ID,
          type: 'STAFF',
          restaurantId: MOCK_RESTAURANT,
          name: 'Mozo Juan',
          roles: ['WAITER'],
        },
      };

      global.fetch = vi.fn().mockImplementation((url: string, options: any) => {
        if (url.includes('/api/auth/staff-login')) {
          const body = JSON.parse(options.body);
          if (body.pin === '1234') {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => mockWaiterResponse,
            });
          }
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => [],
        });
      });

      render(<App />);

      // Switch to ID and PIN
      fireEvent.click(screen.getByText('Staff ID'));
      fireEvent.click(screen.getByText('Código PIN'));

      const idInput = screen.getByPlaceholderText('UUID del personal');
      const pinInput = screen.getByPlaceholderText('PIN numérico');

      fireEvent.change(idInput, { target: { value: MOCK_WAITER_ID } });
      fireEvent.change(pinInput, { target: { value: '1234' } });
      fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

      await waitFor(() => {
        expect(screen.getByText('Mozo Juan')).toBeInTheDocument();
        expect(screen.getByText('Mozo')).toBeInTheDocument();
      });
    });

    it('2.3. Shows generic error message upon invalid credentials', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      render(<App />);

      const emailInput = screen.getByPlaceholderText('mozo@restaurant.com');
      const passwordInput = screen.getByPlaceholderText('••••••••••••');
      fireEvent.change(emailInput, { target: { value: 'wrong@restaurant.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
      fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

      await waitFor(() => {
        expect(screen.getByText(/Invalid credentials|Credenciales inválidas/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /salir/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('3. TableDevice Authentication', () => {
    it('3.1. Successfully connects terminal tablet with secret', async () => {
      const mockDeviceResponse = {
        token: 'mock.jwt.device-token',
        actor: {
          id: MOCK_DEVICE_ID,
          type: 'TABLE_DEVICE',
          restaurantId: MOCK_RESTAURANT,
          name: 'Tablet Mesa 1',
        },
      };

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/auth/device-auth')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockDeviceResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => [],
        });
      });

      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: /tablet/i }));

      const deviceIdInput = screen.getByPlaceholderText('UUID del dispositivo');
      const secretInput = screen.getByPlaceholderText('Secreto de terminal');

      fireEvent.change(deviceIdInput, { target: { value: MOCK_DEVICE_ID } });
      fireEvent.change(secretInput, { target: { value: 'device_secret_xyz' } });
      fireEvent.click(screen.getByRole('button', { name: /conectar terminal/i }));

      await waitFor(() => {
        expect(screen.getByText('Tablet Mesa 1')).toBeInTheDocument();
        expect(screen.getByText('Terminal Tablet')).toBeInTheDocument();
      });
    });
  });

  describe('4. Customer QR/Session Issuance', () => {
    it('4.1. Issues Customer token for table session', async () => {
      const mockCustomerResponse = {
        token: 'mock.jwt.customer-token',
        actor: {
          id: MOCK_CUSTOMER_ID,
          type: 'CUSTOMER',
          restaurantId: MOCK_RESTAURANT,
          name: 'Laura Comensal',
        },
      };

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/auth/customer-session-token')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockCustomerResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => [],
        });
      });

      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: /comensal/i }));

      const nameInput = screen.getByPlaceholderText('Ej: Laura');
      fireEvent.change(nameInput, { target: { value: 'Laura Comensal' } });
      fireEvent.click(screen.getByRole('button', { name: /ingresar a la carta digital/i }));

      await waitFor(() => {
        expect(screen.getByText('Laura Comensal')).toBeInTheDocument();
        expect(screen.getByText('Comensal')).toBeInTheDocument();
      });
    });
  });

  describe('5. Session Lifecycle & Logout', () => {
    it('5.1. Restores session from sessionStorage on initial load', () => {
      const savedSession = {
        token: 'persisted.jwt.token',
        actor: {
          id: MOCK_ADMIN_ID,
          type: 'STAFF',
          restaurantId: MOCK_RESTAURANT,
          name: 'Admin Persistido',
          roles: ['ADMIN'],
        },
      };
      window.sessionStorage.setItem('restaurant_os_auth_session', JSON.stringify(savedSession));

      render(<App />);

      expect(screen.getByText('Admin Persistido')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /salir/i })).toBeInTheDocument();
    });

    it('5.2. Logout cleans up state and sessionStorage, returning to LoginForm', async () => {
      const savedSession = {
        token: 'persisted.jwt.token',
        actor: {
          id: MOCK_ADMIN_ID,
          type: 'STAFF',
          restaurantId: MOCK_RESTAURANT,
          name: 'Admin Para Salir',
          roles: ['ADMIN'],
        },
      };
      window.sessionStorage.setItem('restaurant_os_auth_session', JSON.stringify(savedSession));

      render(<App />);

      const logoutBtn = screen.getByRole('button', { name: /salir/i });
      fireEvent.click(logoutBtn);

      await waitFor(() => {
        expect(window.sessionStorage.getItem('restaurant_os_auth_session')).toBeNull();
        expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
        expect(screen.queryByText('Admin Para Salir')).not.toBeInTheDocument();
      });
    });
  });

  describe('6. Route Guards & Access Control in UI', () => {
    it('6.1. WAITER only sees waiter-permitted workspace tabs', () => {
      const waiterSession = {
        token: 'waiter.jwt.token',
        actor: {
          id: MOCK_WAITER_ID,
          type: 'STAFF',
          restaurantId: MOCK_RESTAURANT,
          name: 'Mozo Pedro',
          roles: ['WAITER'],
        },
      };
      window.sessionStorage.setItem('restaurant_os_auth_session', JSON.stringify(waiterSession));

      render(<App />);

      // Allowed for Waiter: Mozo
      expect(screen.getByText('Mozo / Comandas')).toBeInTheDocument();

      // Disallowed for Waiter: Dashboard, Admin, Caja, Cocina, Tablet, Cliente
      expect(screen.queryByText('Administración')).not.toBeInTheDocument();
      expect(screen.queryByText('Caja & Facturación')).not.toBeInTheDocument();
      expect(screen.queryByText('Cocina (KDS)')).not.toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('6.2. TABLE_DEVICE only sees Table workspace tab', () => {
      const deviceSession = {
        token: 'device.jwt.token',
        actor: {
          id: MOCK_DEVICE_ID,
          type: 'TABLE_DEVICE',
          restaurantId: MOCK_RESTAURANT,
          name: 'Tablet Mesa 3',
        },
      };
      window.sessionStorage.setItem('restaurant_os_auth_session', JSON.stringify(deviceSession));

      render(<App />);

      expect(screen.getByText('Mesa (Tablet)')).toBeInTheDocument();
      expect(screen.queryByText('Administración')).not.toBeInTheDocument();
      expect(screen.queryByText('Mozo / Comandas')).not.toBeInTheDocument();
      expect(screen.queryByText('Recepción & Mesas')).not.toBeInTheDocument();
    });
  });

  describe('7. API Client Security & Authorization Header', () => {
    it('7.1. Sends Authorization: Bearer header and does NOT send x-actor-* headers', async () => {
      const savedSession = {
        token: 'secure.bearer.jwt.token',
        actor: {
          id: MOCK_ADMIN_ID,
          type: 'STAFF',
          restaurantId: MOCK_RESTAURANT,
          name: 'Admin Test',
          roles: ['ADMIN'],
        },
      };
      window.sessionStorage.setItem('restaurant_os_auth_session', JSON.stringify(savedSession));

      let capturedHeaders: any = null;
      global.fetch = vi.fn().mockImplementation((url: string, options: any) => {
        capturedHeaders = options?.headers;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => [],
        });
      });

      render(<App />);

      await waitFor(() => {
        expect(capturedHeaders).toBeTruthy();
        expect(capturedHeaders['Authorization']).toBe('Bearer secure.bearer.jwt.token');
        expect(capturedHeaders['x-actor-type']).toBeUndefined();
        expect(capturedHeaders['x-actor-id']).toBeUndefined();
        expect(capturedHeaders['x-restaurant-id']).toBeUndefined();
      });
    });
  });
});
