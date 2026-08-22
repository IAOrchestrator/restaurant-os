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

export function AdminPage() {
  const { restaurantId, authToken } = useAppContext();
  const { request } = useApi();

  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [devices, setDevices] = useState<AdminDevice[]>([]);
  const [events, setEvents] = useState<DomainEventItem[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'CATEGORIES' | 'INVENTORY' | 'DEVICES' | 'AUDIT'>('PRODUCTS');

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

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [catRes, prodRes, devRes, evRes, matRes] = await Promise.all([
      request<AdminCategory[]>(`/api/catalog/categories?restaurantId=${restaurantId}`),
      request<AdminProduct[]>(`/api/catalog/products?restaurantId=${restaurantId}`),
      request<AdminDevice[]>(`/api/table-devices?restaurantId=${restaurantId}`),
      request<DomainEventItem[]>(`/api/events?restaurantId=${restaurantId}&limit=15`),
      request<RawMaterialItem[]>(`/api/inventory/raw-materials?restaurantId=${restaurantId}`),
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
    setLoading(false);
  }, [request, restaurantId, newProdCatId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 6000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Real-time SSE
  useSse({
    token: authToken,
    eventTypes: ['PRODUCT_CREATED', 'PRODUCT_UPDATED', 'TABLE_DEVICE_REGISTERED', 'TABLE_ASSIGNED', 'STOCK_ALERT_TRIGGERED'],
    onEvent: () => {
      fetchData();
    },
  });

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
  const handleToggleProduct = async (prodId: string, currentAvailable: boolean) => {
    const res = await request(`/api/catalog/products/${prodId}`, {
      method: 'PATCH',
      body: JSON.stringify({ available: !currentAvailable }),
    });
    if (res.data) {
      fetchData();
    }
  };

  // Register Device
  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevName.trim()) return;

    const res = await request('/api/table-devices', {
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
      setMsg({ type: 'success', text: '📱 Tablet de mesa registrada con éxito.' });
      fetchData();
    }
  };

  // Create Raw Material
  const handleCreateRawMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatName.trim()) return;

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
      setMsg({ type: 'success', text: '📦 Insumo agregado al inventario.' });
      fetchData();
    }
  };

  // Adjust Raw Material Stock
  const handleAdjustStock = async (id: string, adjustment: number) => {
    const res = await request(`/api/inventory/raw-materials/${id}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ adjustment }),
    });
    if (res.data) {
      fetchData();
    }
  };

  const lowStockCount = rawMaterials.filter((m) => m.currentStock <= m.minStockAlert).length;

  return (
    <div className="min-h-screen bg-background text-text-primary p-4 lg:p-6 pb-24">
      {/* Header Bar */}
      <header className="glass sticky top-0 z-20 rounded-lg px-5 h-[64px] flex items-center justify-between mb-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-amber text-black flex items-center justify-center font-bold shadow-glowAmber">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Panel de Administración</h1>
            <p className="text-xs text-text-tertiary">Catálogo de platos, stock de insumos, tablets y auditoría</p>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-md bg-surface-1 border border-white/5 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xs bg-amber/15 text-amber flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-tertiary font-medium">Platos en Carta</div>
            <div className="text-xl font-bold font-mono mt-0.5">{products.length}</div>
          </div>
        </div>

        <div className="rounded-md bg-surface-1 border border-white/5 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xs bg-emerald/15 text-emerald flex items-center justify-center font-bold">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-tertiary font-medium">Insumos en Stock</div>
            <div className="text-xl font-bold font-mono mt-0.5">{rawMaterials.length}</div>
          </div>
        </div>

        <div className="rounded-md bg-surface-1 border border-white/5 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xs bg-white/10 text-white flex items-center justify-center font-bold">
            <Tablet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-tertiary font-medium">Tablets Activas</div>
            <div className="text-xl font-bold font-mono mt-0.5">{devices.length}</div>
          </div>
        </div>

        <div className="rounded-md bg-surface-1 border border-white/5 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xs bg-amber/15 text-amber flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-tertiary font-medium">Eventos Auditados</div>
            <div className="text-xl font-bold font-mono mt-0.5">{events.length}</div>
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
          { id: 'PRODUCTS', label: 'Platos & Carta', icon: Package },
          { id: 'INVENTORY', label: `Stock & Insumos ${lowStockCount > 0 ? `(${lowStockCount}!)` : ''}`, icon: Boxes },
          { id: 'CATEGORIES', label: 'Categorías', icon: Layers },
          { id: 'DEVICES', label: 'Tablets de Mesa', icon: Tablet },
          { id: 'AUDIT', label: 'Auditoría en Tiempo Real', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`h-9 px-4 rounded-pill text-xs font-semibold flex items-center gap-2 transition ${
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
