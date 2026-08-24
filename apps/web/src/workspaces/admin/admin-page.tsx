import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAppContext } from '../../hooks/useContextState';
import { useSse } from '../../hooks/useSse';
import {
  Sliders,
  FolderPlus,
  PlusCircle,
  Tablet,
  Activity,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Package,
  Layers,
  ShieldCheck,
  Boxes,
  AlertTriangle,
  Plus,
  Minus,
  Users,
  LayoutGrid,
  UserPlus,
  MapPin,
  Utensils,
  DollarSign,
  Clock,
  KeyRound,
  Lock,
} from 'lucide-react';

export interface AdminCategory {
  id: string;
  name: string;
  displayOrder: number;
}

export interface AdminProduct {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  available: boolean;
}

export interface AdminDevice {
  id: string;
  name: string;
  tableId: string | null;
  active: boolean;
}

export interface DomainEventItem {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt?: string;
  createdAt?: string;
}

export interface RawMaterialItem {
  id: string;
  name: string;
  unit: 'KG' | 'G' | 'L' | 'ML' | 'UNIT';
  currentStock: number;
  minStockAlert: number;
  unitCost: number;
}

export interface AdminStaffItem {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  active: boolean;
  roles: string[];
  createdAt?: string;
}

export interface AdminTableItem {
  id: string;
  restaurantId: string;
  number: number;
  capacity: number;
  status: 'AVAILABLE' | 'ASSIGNED' | 'OCCUPIED';
}

export interface AdminTableSessionItem {
  id: string;
  tableId: string;
  status: string;
  currentWaiterId: string;
  openedAt?: string;
}

export interface AdminOrderItem {
  id: string;
  tableSessionId?: string | null;
  status: string;
  totalAmount: number;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
}

export function AdminPage() {
  const { restaurantId, authToken } = useAppContext();
  const { request } = useApi();

  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [devices, setDevices] = useState<AdminDevice[]>([]);
  const [events, setEvents] = useState<DomainEventItem[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterialItem[]>([]);
  const [staffList, setStaffList] = useState<AdminStaffItem[]>([]);
  const [tablesList, setTablesList] = useState<AdminTableItem[]>([]);
  const [sessionsList, setSessionsList] = useState<AdminTableSessionItem[]>([]);
  const [ordersList, setOrdersList] = useState<AdminOrderItem[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'OPERATIONS' | 'STAFF' | 'TABLES' | 'PRODUCTS' | 'CATEGORIES' | 'INVENTORY' | 'DEVICES' | 'AUDIT'
  >('OPERATIONS');

  // Filter for Operations
  const [selectedWaiterFilter, setSelectedWaiterFilter] = useState<string>('ALL');

  // Forms
  const [newCatName, setNewCatName] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState<number>(0);
  const [newProdCatId, setNewProdCatId] = useState('');
  const [newDevName, setNewDevName] = useState('');
  const [newMatName, setNewMatName] = useState('');
  const [newMatUnit, setNewMatUnit] = useState<'KG' | 'G' | 'L' | 'ML' | 'UNIT'>('KG');
  const [newMatStock, setNewMatStock] = useState<number>(10);
  const [newMatMinAlert, setNewMatMinAlert] = useState<number>(2);
  const [newMatCost, setNewMatCost] = useState<number>(500);

  // Staff Form
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<string>('WAITER');
  const [newStaffPin, setNewStaffPin] = useState('1234');
  const [newStaffPassword, setNewStaffPassword] = useState('password123');

  // Table Form
  const [newTableNumber, setNewTableNumber] = useState<number>(9);
  const [newTableCapacity, setNewTableCapacity] = useState<number>(4);

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [catRes, prodRes, devRes, evRes, matRes, staffRes, tablesRes, sessRes, ordRes] = await Promise.all([
      request<AdminCategory[]>(`/api/catalog/categories?restaurantId=${restaurantId}`),
      request<AdminProduct[]>(`/api/catalog/products?restaurantId=${restaurantId}`),
      request<AdminDevice[]>(`/api/table-devices?restaurantId=${restaurantId}`),
      request<DomainEventItem[]>(`/api/events?restaurantId=${restaurantId}&limit=20`),
      request<RawMaterialItem[]>(`/api/inventory/raw-materials?restaurantId=${restaurantId}`),
      request<AdminStaffItem[]>(`/api/staff?restaurantId=${restaurantId}`),
      request<AdminTableItem[]>(`/api/tables?restaurantId=${restaurantId}`),
      request<AdminTableSessionItem[]>(`/api/table-sessions?restaurantId=${restaurantId}`),
      request<AdminOrderItem[]>(`/api/orders?restaurantId=${restaurantId}`),
    ]);

    if (catRes.data) {
      setCategories(catRes.data);
      if (!newProdCatId && catRes.data.length > 0) {
        setNewProdCatId(catRes.data[0].id);
      }
    }
    if (prodRes.data) setProducts(prodRes.data);
    if (devRes.data) setDevices(devRes.data);
    if (evRes.data) setEvents(evRes.data);
    if (matRes.data) setRawMaterials(matRes.data);
    if (staffRes.data) setStaffList(staffRes.data);
    if (tablesRes.data) {
      setTablesList(tablesRes.data.sort((a, b) => a.number - b.number));
      setNewTableNumber(tablesRes.data.length + 1);
    }
    if (sessRes.data) setSessionsList(sessRes.data.filter((s) => s.status !== 'CLOSED'));
    if (ordRes.data) setOrdersList(ordRes.data.filter((o) => o.status !== 'CANCELLED'));

    setLoading(false);
  }, [request, restaurantId, newProdCatId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time SSE
  useSse({
    token: authToken,
    eventTypes: [
      'TABLE_DEVICE_REGISTERED',
      'TABLE_DEVICE_ASSOCIATED',
      'TABLE_DEVICE_DISASSOCIATED',
      'TABLE_ASSIGNED',
      'TABLE_CLOSED',
      'ORDER_SENT_TO_KITCHEN',
      'ORDER_DELIVERED',
      'ACCOUNT_CLOSED',
      'REVIEW_CREATED',
    ],
    onEvent: () => {
      fetchData();
    },
    onReconnect: () => {
      fetchData();
    },
  });

  // Create Staff Member
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;

    setMsg(null);
    const res = await request('/api/staff', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId,
        name: newStaffName.trim(),
        email: newStaffEmail.trim() || undefined,
        role: newStaffRole,
        pin: newStaffPin.trim() || '1234',
        password: newStaffPassword.trim() || 'password123',
      }),
    });

    if (res.error) {
      setMsg({ type: 'error', text: res.error });
    } else {
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPin('1234');
      setNewStaffPassword('password123');
      setMsg({ type: 'success', text: `👤 Personal "${newStaffName}" registrado con éxito.` });
      fetchData();
    }
  };

  // Create Table
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber || newTableCapacity <= 0) return;

    setMsg(null);
    const res = await request('/api/tables', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId,
        number: Number(newTableNumber),
        capacity: Number(newTableCapacity),
      }),
    });

    if (res.error) {
      setMsg({ type: 'error', text: res.error });
    } else {
      setMsg({ type: 'success', text: `🪑 Mesa #${newTableNumber} creada exitosamente.` });
      fetchData();
    }
  };

  // Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const res = await request('/api/catalog/categories', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId,
        name: newCatName.trim(),
        displayOrder: categories.length + 1,
      }),
    });

    if (res.error) {
      setMsg({ type: 'error', text: res.error });
    } else {
      setNewCatName('');
      setMsg({ type: 'success', text: '✨ Categoría creada exitosamente.' });
      fetchData();
    }
  };

  // Create Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdCatId || newProdPrice <= 0) return;

    const res = await request('/api/catalog/products', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId,
        categoryId: newProdCatId,
        name: newProdName.trim(),
        price: Number(newProdPrice),
      }),
    });

    if (res.error) {
      setMsg({ type: 'error', text: res.error });
    } else {
      setNewProdName('');
      setNewProdPrice(0);
      setMsg({ type: 'success', text: '🍲 Plato añadido al menú exitosamente.' });
      fetchData();
    }
  };

  // Toggle Product Availability
  const handleToggleProduct = async (id: string, current: boolean) => {
    const res = await request(`/api/catalog/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable: !current }),
    });

    if (res.error) {
      setMsg({ type: 'error', text: res.error });
    } else {
      fetchData();
    }
  };

  // Create Raw Material
  const handleCreateRawMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatName.trim() || newMatStock < 0) return;

    const res = await request('/api/inventory/raw-materials', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId,
        name: newMatName.trim(),
        unit: newMatUnit,
        currentStock: Number(newMatStock),
        minStockAlert: Number(newMatMinAlert),
        unitCost: Number(newMatCost),
      }),
    });

    if (res.error) {
      setMsg({ type: 'error', text: res.error });
    } else {
      setNewMatName('');
      setNewMatStock(10);
      setMsg({ type: 'success', text: '📦 Insumo registrado en el inventario.' });
      fetchData();
    }
  };

  // Adjust Raw Material Stock
  const handleAdjustStock = async (id: string, delta: number) => {
    const res = await request(`/api/inventory/raw-materials/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify({
        quantity: Math.abs(delta),
        type: delta >= 0 ? 'RESTOCK' : 'MANUAL_ADJUST',
        reason: 'Ajuste manual desde panel de administración',
      }),
    });

    if (res.error) {
      setMsg({ type: 'error', text: res.error });
    } else {
      fetchData();
    }
  };

  // Register Device
  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevName.trim()) return;

    const res = await request('/api/table-devices/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId,
        name: newDevName.trim(),
      }),
    });

    if (res.error) {
      setMsg({ type: 'error', text: res.error });
    } else {
      setNewDevName('');
      setMsg({ type: 'success', text: '📱 Tablet registrada exitosamente.' });
      fetchData();
    }
  };

  // Operations map helpers
  const staffMap = staffList.reduce<Record<string, string>>((acc, s) => {
    acc[s.id] = s.name;
    return acc;
  }, {});

  const sessionByTableId = sessionsList.reduce<Record<string, AdminTableSessionItem>>((acc, s) => {
    acc[s.tableId] = s;
    return acc;
  }, {});

  const productMap = products.reduce<Record<string, string>>((acc, p) => {
    acc[p.id] = p.name;
    return acc;
  }, {});

  const lowStockCount = rawMaterials.filter((m) => m.currentStock <= m.minStockAlert).length;
  const waiters = staffList.filter((s) => s.roles.includes('WAITER'));

  return (
    <div className="min-h-screen bg-background text-text-primary p-4 lg:p-6">
      {/* Header Bar */}
      <header className="glass sticky top-0 z-20 rounded-lg px-5 h-[64px] flex items-center justify-between mb-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-amber text-black flex items-center justify-center font-bold shadow-glowAmber">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Panel de Control & Administración</h1>
            <p className="text-xs text-text-tertiary">Gestión integral de personal, mesas, carta, stock y monitoreo</p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="h-9 px-3 rounded-pill glass hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
          title="Refrescar"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refrescar</span>
        </button>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-md bg-surface-1 border border-white/5 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xs bg-amber/15 text-amber flex items-center justify-center font-bold">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-tertiary font-medium">Mesas Activas</div>
            <div className="text-xl font-bold font-mono mt-0.5">
              {sessionsList.length} / {tablesList.length}
            </div>
          </div>
        </div>

        <div className="rounded-md bg-surface-1 border border-white/5 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xs bg-emerald/15 text-emerald flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-tertiary font-medium">Personal Registrado</div>
            <div className="text-xl font-bold font-mono mt-0.5">{staffList.length}</div>
          </div>
        </div>

        <div className="rounded-md bg-surface-1 border border-white/5 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xs bg-cyan/15 text-cyan flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-tertiary font-medium">Platos en Carta</div>
            <div className="text-xl font-bold font-mono mt-0.5">{products.length}</div>
          </div>
        </div>

        <div className="rounded-md bg-surface-1 border border-white/5 p-4 shadow-sm flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xs flex items-center justify-center font-bold ${
            lowStockCount > 0 ? 'bg-crimson/15 text-crimson animate-pulse' : 'bg-emerald/15 text-emerald'
          }`}>
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-tertiary font-medium">Alertas Stock</div>
            <div className={`text-xl font-bold font-mono mt-0.5 ${lowStockCount > 0 ? 'text-crimson' : 'text-emerald'}`}>
              {lowStockCount} {lowStockCount > 0 ? 'Críticos' : 'Óptimo'}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {msg && (
        <div
          className={`p-3.5 rounded-md mb-6 text-xs font-medium flex items-center gap-2.5 shadow-card animate-slide-in ${
            msg.type === 'success'
              ? 'bg-emerald/15 border border-emerald/30 text-emerald'
              : 'bg-crimson/15 border border-crimson/30 text-crimson'
          }`}
        >
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 p-1 rounded-full glass w-fit overflow-x-auto scrollbar-none">
        {[
          { id: 'OPERATIONS', label: 'Monitoreo de Salón', icon: LayoutGrid },
          { id: 'STAFF', label: 'Personal & Mozos', icon: Users },
          { id: 'TABLES', label: 'Mesas & Salón', icon: MapPin },
          { id: 'PRODUCTS', label: 'Platos & Carta', icon: Package },
          { id: 'CATEGORIES', label: 'Categorías', icon: Layers },
          { id: 'INVENTORY', label: `Stock & Insumos ${lowStockCount > 0 ? `(${lowStockCount}!)` : ''}`, icon: Boxes },
          { id: 'DEVICES', label: 'Tablets', icon: Tablet },
          { id: 'AUDIT', label: 'Auditoría en Vivo', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`h-9 px-4 rounded-pill text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
                isCurrent
                  ? 'bg-amber text-black shadow-glowAmber font-bold'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab: Operations / Monitoreo de Salón */}
      {activeTab === 'OPERATIONS' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-1 border border-white/5 rounded-lg p-4 shadow-card">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Estado del Salón y Asignación por Mozo</h2>
              <p className="text-xs text-text-tertiary">Monitoreo en tiempo real de mesas ocupadas, consumos acumulados y mozo a cargo</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary font-medium">Filtrar por Mozo:</span>
              <select
                value={selectedWaiterFilter}
                onChange={(e) => setSelectedWaiterFilter(e.target.value)}
                className="h-8 rounded-pill bg-surface-2 border border-white/10 px-3 text-xs font-bold text-amber focus:outline-none cursor-pointer"
              >
                <option value="ALL">Todos los Mozos ({waiters.length})</option>
                {waiters.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tablesList
              .filter((table) => {
                if (selectedWaiterFilter === 'ALL') return true;
                const session = sessionByTableId[table.id];
                return session?.currentWaiterId === selectedWaiterFilter;
              })
              .map((table) => {
                const session = sessionByTableId[table.id];
                const isOccupied = Boolean(session);
                const waiterName = session ? staffMap[session.currentWaiterId] || 'Mozo' : 'Sin asignar';
                const sessionOrders = session ? ordersList.filter((o) => o.tableSessionId === session.id) : [];
                const totalConsumption = sessionOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

                return (
                  <div
                    key={table.id}
                    className={`rounded-lg border p-4 shadow-card transition flex flex-col justify-between ${
                      isOccupied
                        ? 'bg-surface-2 border-amber/40 shadow-glowAmber/10'
                        : 'bg-surface-1 border-white/5 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xs font-bold text-sm flex items-center justify-center ${
                            isOccupied ? 'bg-amber text-black shadow-glowAmber' : 'bg-white/10 text-text-secondary'
                          }`}>
                            M{table.number}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-text-primary">Mesa {table.number}</div>
                            <div className="text-[11px] text-text-tertiary font-mono">Capacidad: {table.capacity} pax</div>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-pill ${
                          isOccupied ? 'bg-amber/20 text-amber border border-amber/30' : 'bg-emerald/15 text-emerald border border-emerald/30'
                        }`}>
                          {isOccupied ? 'OCUPADA' : 'LIBRE'}
                        </span>
                      </div>

                      {isOccupied ? (
                        <div className="space-y-2 py-2 border-t border-white/5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-text-tertiary">Mozo a cargo:</span>
                            <span className="font-bold text-text-primary">{waiterName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-tertiary">Comandas:</span>
                            <span className="font-mono font-semibold text-text-secondary">{sessionOrders.length} pedidos</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-tertiary">Total Acumulado:</span>
                            <span className="font-mono font-bold text-amber">${totalConsumption.toLocaleString()}</span>
                          </div>

                          {/* Quick dishes list */}
                          {sessionOrders.length > 0 && (
                            <div className="pt-2 border-t border-white/5 space-y-1">
                              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-bold">Platos pedidos:</div>
                              <div className="max-h-20 overflow-y-auto space-y-0.5 pr-1">
                                {sessionOrders.flatMap((o) => o.items).slice(0, 4).map((it, idx) => (
                                  <div key={idx} className="flex justify-between text-[11px] text-text-secondary">
                                    <span>{it.quantity}x {productMap[it.productId] || it.productId}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-text-tertiary text-xs">
                          Mesa disponible para recibir comensales
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tab: Staff Management */}
      {activeTab === 'STAFF' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-8 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
              <div>
                <h2 className="text-sm font-bold">Personal y Equipo del Restaurante</h2>
                <p className="text-xs text-text-tertiary">Listado de mozos, cocineros, cajeros y recepcionistas</p>
              </div>
              <span className="text-xs font-mono text-text-tertiary">{staffList.length} miembros</span>
            </div>

            <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
              {staffList.map((s) => (
                <div
                  key={s.id}
                  className="rounded-md bg-surface-2 border border-white/5 p-3.5 flex items-center justify-between shadow-sm hover:border-white/15 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber/20 text-amber font-bold text-xs flex items-center justify-center">
                      {s.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-text-primary">{s.name}</div>
                      <div className="text-[11px] text-text-tertiary font-mono">{s.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {s.roles.map((role) => (
                      <span
                        key={role}
                        className={`text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-pill ${
                          role === 'ADMIN'
                            ? 'bg-crimson/20 text-crimson border border-crimson/30'
                            : role === 'WAITER'
                            ? 'bg-amber/20 text-amber border border-amber/30'
                            : role === 'KITCHEN'
                            ? 'bg-orange/20 text-orange border border-orange/30'
                            : 'bg-emerald/20 text-emerald border border-emerald/30'
                        }`}
                      >
                        {role}
                      </span>
                    ))}
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-pill bg-emerald/10 text-emerald">
                      ACTIVO
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Form: Add Staff Member */}
          <section className="lg:col-span-4 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
            <div className="text-xs font-bold uppercase tracking-wider text-amber mb-4 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" />
              <span>Registrar Nuevo Personal</span>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3">
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Nombre Completo:</label>
                <input
                  type="text"
                  placeholder="Ej: Laura Morales (Mozo)"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  required
                  className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs focus:outline-none focus:border-amber"
                />
              </div>

              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Email de Acceso:</label>
                <input
                  type="email"
                  placeholder="laura@pizzeria.com"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs focus:outline-none focus:border-amber"
                />
              </div>

              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Rol / Puesto:</label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value)}
                  required
                  className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs focus:outline-none focus:border-amber cursor-pointer"
                >
                  <option value="WAITER">Mozo / Camarero</option>
                  <option value="KITCHEN">Cocinero / Chef</option>
                  <option value="CASHIER">Cajero / POS</option>
                  <option value="RECEPTION">Recepción / Host</option>
                  <option value="ADMIN">Administrador General</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-text-tertiary block mb-1">PIN Rápido (4 dígitos):</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={newStaffPin}
                    onChange={(e) => setNewStaffPin(e.target.value)}
                    required
                    className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs font-mono focus:outline-none focus:border-amber"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-tertiary block mb-1">Contraseña:</label>
                  <input
                    type="password"
                    value={newStaffPassword}
                    onChange={(e) => setNewStaffPassword(e.target.value)}
                    required
                    className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs font-mono focus:outline-none focus:border-amber"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-10 rounded-sm bg-amber text-black hover:bg-amber-hover font-bold text-xs shadow-glowAmber transition active:scale-98 mt-2"
              >
                + Registrar Personal
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Tab: Tables Management */}
      {activeTab === 'TABLES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-8 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
              <div>
                <h2 className="text-sm font-bold">Mesas del Restaurante</h2>
                <p className="text-xs text-text-tertiary">Distribución física de las mesas y capacidad por salón</p>
              </div>
              <span className="text-xs font-mono text-text-tertiary">{tablesList.length} mesas</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[550px] overflow-y-auto pr-1">
              {tablesList.map((t) => {
                const session = sessionByTableId[t.id];
                return (
                  <div
                    key={t.id}
                    className={`rounded-md border p-3 flex flex-col justify-between gap-2 shadow-sm ${
                      session ? 'bg-surface-2 border-amber/40' : 'bg-surface-2 border-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded bg-amber text-black font-bold text-xs flex items-center justify-center">
                        M{t.number}
                      </span>
                      <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                        session ? 'bg-amber/20 text-amber' : 'bg-emerald/15 text-emerald'
                      }`}>
                        {session ? 'OCUPADA' : 'LIBRE'}
                      </span>
                    </div>

                    <div className="text-[11px] text-text-tertiary font-mono">
                      Capacidad: {t.capacity} pax
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Form: Add Table */}
          <section className="lg:col-span-4 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
            <div className="text-xs font-bold uppercase tracking-wider text-amber mb-4 flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              <span>Añadir Nueva Mesa</span>
            </div>

            <form onSubmit={handleCreateTable} className="space-y-3">
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Número de Mesa:</label>
                <input
                  type="number"
                  min="1"
                  value={newTableNumber || ''}
                  onChange={(e) => setNewTableNumber(Number(e.target.value))}
                  required
                  className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs font-mono focus:outline-none focus:border-amber"
                />
              </div>

              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Capacidad (Pax / Comensales):</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={newTableCapacity || ''}
                  onChange={(e) => setNewTableCapacity(Number(e.target.value))}
                  required
                  className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs font-mono focus:outline-none focus:border-amber"
                />
              </div>

              <button
                type="submit"
                className="w-full h-10 rounded-sm bg-amber text-black hover:bg-amber-hover font-bold text-xs shadow-glowAmber transition active:scale-98 mt-2"
              >
                + Crear Mesa #{newTableNumber}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Tab: Products */}
      {activeTab === 'PRODUCTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-8 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
              <h2 className="text-sm font-bold">Platos en el Menú</h2>
              <span className="text-xs font-mono text-text-tertiary">{products.length} productos</span>
            </div>

            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="rounded-md bg-surface-2 border border-white/5 p-3 flex items-center justify-between shadow-sm hover:border-white/15 transition"
                >
                  <div>
                    <div className="text-xs font-bold text-text-primary">{p.name}</div>
                    <div className="text-[11px] text-text-tertiary font-mono">
                      Categoría ID: #{p.categoryId.slice(0, 6)}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-mono text-sm font-bold text-amber">${p.price.toLocaleString()}</span>
                    <button
                      onClick={() => handleToggleProduct(p.id, p.available)}
                      className={`h-7 px-2.5 rounded-pill text-[10px] font-bold transition flex items-center gap-1 ${
                        p.available
                          ? 'bg-emerald/15 text-emerald border border-emerald/30'
                          : 'bg-white/10 text-text-tertiary'
                      }`}
                    >
                      {p.available ? 'DISPONIBLE' : 'AGOTADO'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Form: Add Product */}
          <section className="lg:col-span-4 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
            <div className="text-xs font-bold uppercase tracking-wider text-amber mb-4 flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4" />
              <span>Añadir Nuevo Plato</span>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Nombre del plato:</label>
                <input
                  type="text"
                  placeholder="Ej: Ojo de Bife con Papas"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  required
                  className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs focus:outline-none focus:border-amber"
                />
              </div>

              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Precio ($):</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="12500"
                  value={newProdPrice || ''}
                  onChange={(e) => setNewProdPrice(Number(e.target.value))}
                  required
                  className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs font-mono focus:outline-none focus:border-amber"
                />
              </div>

              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Categoría:</label>
                <select
                  value={newProdCatId}
                  onChange={(e) => setNewProdCatId(e.target.value)}
                  required
                  className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs focus:outline-none focus:border-amber cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-surface-2 text-text-primary">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full h-10 rounded-sm bg-amber text-black hover:bg-amber-hover font-bold text-xs shadow-glowAmber transition active:scale-98 mt-2"
              >
                + Guardar Plato
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Tab: Inventory & Raw Materials */}
      {activeTab === 'INVENTORY' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-8 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
              <div>
                <h2 className="text-sm font-bold">Control de Inventario & Materias Primas</h2>
                <p className="text-xs text-text-tertiary">El stock se deduce automáticamente con cada comanda enviada a cocina</p>
              </div>
              <span className="text-xs font-mono text-text-tertiary">{rawMaterials.length} insumos</span>
            </div>

            <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
              {rawMaterials.length === 0 ? (
                <div className="h-40 border border-dashed border-white/10 rounded-md flex flex-col items-center justify-center text-text-tertiary gap-2">
                  <Boxes className="w-6 h-6 opacity-30" />
                  <span className="text-xs">No hay insumos registrados aún</span>
                </div>
              ) : (
                rawMaterials.map((mat) => {
                  const isCritical = mat.currentStock <= mat.minStockAlert;
                  const isLow = mat.currentStock <= mat.minStockAlert * 1.5;

                  return (
                    <div
                      key={mat.id}
                      className={`p-3.5 rounded-md border flex items-center justify-between shadow-sm transition ${
                        isCritical
                          ? 'bg-crimson/10 border-crimson/30'
                          : isLow
                          ? 'bg-surface-2 border-amber/30'
                          : 'bg-surface-2 border-white/5'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text-primary">{mat.name}</span>
                          <span
                            className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-pill ${
                              isCritical
                                ? 'bg-crimson text-white animate-pulse'
                                : isLow
                                ? 'bg-amber/20 text-amber'
                                : 'bg-emerald/15 text-emerald'
                            }`}
                          >
                            {isCritical ? 'CRÍTICO' : isLow ? 'BAJO' : 'ÓPTIMO'}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-tertiary font-mono mt-1">
                          Alerta mín.: {mat.minStockAlert} {mat.unit} • Costo: ${mat.unitCost}/{mat.unit}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-mono text-sm font-bold text-text-primary">
                          {mat.currentStock} {mat.unit}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleAdjustStock(mat.id, -1)}
                            className="w-7 h-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs"
                            title="Descontar 1 unidad"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleAdjustStock(mat.id, 5)}
                            className="h-7 px-2 rounded bg-amber text-black hover:bg-amber-hover font-bold text-xs flex items-center gap-0.5"
                            title="Reponer +5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>5</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Form: Add Raw Material */}
          <section className="lg:col-span-4 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
            <div className="text-xs font-bold uppercase tracking-wider text-amber mb-4 flex items-center gap-1.5">
              <Boxes className="w-4 h-4" />
              <span>Registrar Nuevo Insumo</span>
            </div>

            <form onSubmit={handleCreateRawMaterial} className="space-y-3">
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Nombre del insumo:</label>
                <input
                  type="text"
                  placeholder="Ej: Harina 000, Queso Mozzarella, Lata Gaseosa"
                  value={newMatName}
                  onChange={(e) => setNewMatName(e.target.value)}
                  required
                  className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs focus:outline-none focus:border-amber"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-text-tertiary block mb-1">Unidad:</label>
                  <select
                    value={newMatUnit}
                    onChange={(e) => setNewMatUnit(e.target.value as any)}
                    className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs focus:outline-none focus:border-amber cursor-pointer"
                  >
                    <option value="KG">Kilogramos (KG)</option>
                    <option value="G">Gramos (G)</option>
                    <option value="L">Litros (L)</option>
                    <option value="ML">Mililitros (ML)</option>
                    <option value="UNIT">Unidades (UNIT)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-text-tertiary block mb-1">Stock Inicial:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newMatStock}
                    onChange={(e) => setNewMatStock(Number(e.target.value))}
                    required
                    className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs font-mono focus:outline-none focus:border-amber"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-text-tertiary block mb-1">Alerta Mínima:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newMatMinAlert}
                    onChange={(e) => setNewMatMinAlert(Number(e.target.value))}
                    required
                    className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs font-mono focus:outline-none focus:border-amber"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-text-tertiary block mb-1">Costo Unitario ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newMatCost}
                    onChange={(e) => setNewMatCost(Number(e.target.value))}
                    required
                    className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs font-mono focus:outline-none focus:border-amber"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-10 rounded-sm bg-amber text-black hover:bg-amber-hover font-bold text-xs shadow-glowAmber transition active:scale-98 mt-2"
              >
                + Guardar Insumo
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Tab: Categories */}
      {activeTab === 'CATEGORIES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-8 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
              <h2 className="text-sm font-bold">Categorías del Menú</h2>
              <span className="text-xs font-mono text-text-tertiary">{categories.length} categorías</span>
            </div>

            <div className="space-y-2">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="rounded-md bg-surface-2 border border-white/5 p-3.5 flex items-center justify-between"
                >
                  <span className="text-xs font-bold">{c.name}</span>
                  <span className="text-[11px] font-mono text-text-tertiary">Orden: {c.displayOrder}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-4 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
            <div className="text-xs font-bold uppercase tracking-wider text-amber mb-4 flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4" />
              <span>Nueva Categoría</span>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Nombre:</label>
                <input
                  type="text"
                  placeholder="Ej: Pastas Caseras"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                  className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs focus:outline-none focus:border-amber"
                />
              </div>

              <button
                type="submit"
                className="w-full h-10 rounded-sm bg-amber text-black hover:bg-amber-hover font-bold text-xs shadow-glowAmber transition active:scale-98"
              >
                + Crear Categoría
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Tab: Devices */}
      {activeTab === 'DEVICES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-8 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
              <h2 className="text-sm font-bold">Tablets de Mesa Registradas</h2>
              <span className="text-xs font-mono text-text-tertiary">{devices.length} dispositivos</span>
            </div>

            <div className="space-y-2">
              {devices.map((d) => (
                <div
                  key={d.id}
                  className="rounded-md bg-surface-2 border border-white/5 p-3.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Tablet className="w-4 h-4 text-amber" />
                    <div>
                      <div className="text-xs font-bold">{d.name}</div>
                      <div className="text-[11px] text-text-tertiary font-mono">ID: #{d.id.slice(0, 8)}</div>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-pill bg-emerald/15 text-emerald border border-emerald/30">
                    ACTIVO
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-4 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
            <div className="text-xs font-bold uppercase tracking-wider text-amber mb-4 flex items-center gap-1.5">
              <Tablet className="w-4 h-4" />
              <span>Registrar Tablet</span>
            </div>

            <form onSubmit={handleRegisterDevice} className="space-y-3">
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Nombre del dispositivo:</label>
                <input
                  type="text"
                  placeholder="Ej: Tablet Mesa 5 (iPad Air)"
                  value={newDevName}
                  onChange={(e) => setNewDevName(e.target.value)}
                  required
                  className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs focus:outline-none focus:border-amber"
                />
              </div>

              <button
                type="submit"
                className="w-full h-10 rounded-sm bg-amber text-black hover:bg-amber-hover font-bold text-xs shadow-glowAmber transition active:scale-98"
              >
                + Registrar Dispositivo
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Tab: Audit */}
      {activeTab === 'AUDIT' && (
        <section className="rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
            <h2 className="text-sm font-bold">Eventos de Dominio en Tiempo Real (Audit Log)</h2>
            <span className="text-xs font-mono text-text-tertiary">Últimos {events.length} registros</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="rounded-xs bg-surface-2 border border-white/5 p-3 flex items-center justify-between font-mono text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald" />
                  <span className="font-bold text-text-primary">{ev.eventType}</span>
                  <span className="text-text-tertiary text-[11px]">[{ev.aggregateType} #{ev.aggregateId.slice(0, 6)}]</span>
                </div>
                <span className="text-text-tertiary text-[11px]">
                  {ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString() : 'Evento'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
