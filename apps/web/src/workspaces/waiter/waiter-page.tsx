import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAppContext } from '../../hooks/useContextState';
import { useSse } from '../../hooks/useSse';
import {
  Bell,
  Utensils,
  Plus,
  Minus,
  Send,
  UserCheck,
  ArrowRightLeft,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

export interface TableSessionItem {
  id: string;
  restaurantId: string;
  tableId: string;
  status: 'OPEN' | 'BILL_REQUESTED' | 'CLOSED';
  currentWaiterId: string;
  customerIds: string[];
}

export interface TableItem {
  id: string;
  number: number;
  capacity: number;
  status: 'AVAILABLE' | 'ASSIGNED' | 'OCCUPIED';
}

export interface StaffItem {
  id: string;
  name: string;
  roles: string[];
}

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  description?: string;
  available: boolean;
  category?: string;
}

export interface ServiceTaskItem {
  id: string;
  type: 'CALL_WAITER' | 'DELIVER_ORDER' | 'REQUEST_BILL' | 'CHECK_ACCOUNT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  tableSessionId?: string;
  notes?: string;
}

export function WaiterPage() {
  const { restaurantId, actorId, authToken } = useAppContext();
  const { request } = useApi();
  const [sessions, setSessions] = useState<TableSessionItem[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [waiters, setWaiters] = useState<StaffItem[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [tasks, setTasks] = useState<ServiceTaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [cart, setCart] = useState<Array<{ product: CatalogProduct; quantity: number; notes: string }>>([]);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [readyAlert, setReadyAlert] = useState<{ taskOrOrderId: string; tableNumber: number; text: string } | null>(null);
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  const [targetWaiterId, setTargetWaiterId] = useState<string>('');

  // Active waiter in this terminal
  const [currentWaiterId, setCurrentWaiterId] = useState<string>(actorId || '');
  const [tableFilter, setTableFilter] = useState<'MINE' | 'ALL'>('MINE');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionsRes, tablesRes, staffRes, productsRes, tasksRes] = await Promise.all([
        request<TableSessionItem[]>(`/api/table-sessions?restaurantId=${restaurantId}`),
        request<TableItem[]>(`/api/tables?restaurantId=${restaurantId}`),
        request<StaffItem[]>(`/api/staff?restaurantId=${restaurantId}&role=WAITER`),
        request<CatalogProduct[]>(`/api/catalog/products?restaurantId=${restaurantId}`),
        request<ServiceTaskItem[]>(`/api/service/tasks?restaurantId=${restaurantId}`),
      ]);

      if (sessionsRes.data) {
        const activeSessions = sessionsRes.data.filter((s) => s.status !== 'CLOSED');
        setSessions(activeSessions);
        if (!selectedSessionId && activeSessions.length > 0) {
          const mine = activeSessions.find((s) => s.currentWaiterId === currentWaiterId);
          setSelectedSessionId(mine ? mine.id : activeSessions[0].id);
        }
      }
      if (tablesRes.data) setTables(tablesRes.data);
      if (staffRes.data) setWaiters(staffRes.data);
      if (productsRes.data) setProducts(productsRes.data.filter((p) => p.available));
      if (tasksRes.data) setTasks(tasksRes.data.filter((t) => t.status !== 'COMPLETED'));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [request, restaurantId, currentWaiterId, selectedSessionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync waiter terminal
  useEffect(() => {
    if (actorId && actorId !== currentWaiterId) {
      setCurrentWaiterId(actorId);
    }
  }, [actorId, currentWaiterId]);

  // Real-time SSE Alerts
  useSse({
    token: authToken,
    eventTypes: [
      'TABLE_ASSIGNED',
      'TABLE_CHANGED',
      'WAITER_CHANGED',
      'ORDER_CONFIRMED',
      'ORDER_SENT_TO_KITCHEN',
      'ORDER_NEARLY_READY',
      'ORDER_READY',
      'ORDER_DELIVERED',
      'SERVICE_TASK_CREATED',
      'TABLE_CLOSED',
      'ACCOUNT_CLOSED',
    ],
    onEvent: (event) => {
      fetchData();
      if (event.type === 'ORDER_READY') {
        const tableNum = (event.payload as any)?.tableNumber || 1;
        setReadyAlert({
          taskOrOrderId: (event.payload as any)?.orderId || 'order-1',
          tableNumber: tableNum,
          text: `¡Plato Listo para Mesa ${tableNum}!`,
        });
      }
    },
    onReconnect: () => {
      fetchData();
    },
  });

  const tableMap = (tables || []).reduce<Record<string, number>>((acc, t) => {
    acc[t.id] = t.number;
    return acc;
  }, {});

  const waiterMap = (waiters || []).reduce<Record<string, string>>((acc, w) => {
    acc[w.id] = w.name;
    return acc;
  }, {});

  const activeWaiter = (waiters || []).find((w) => w.id === currentWaiterId) || waiters[0];

  const handleSelectWaiterTerminal = (waiterId: string) => {
    setCurrentWaiterId(waiterId);
  };

  const filteredSessions = (sessions || []).filter((s) => {
    if (tableFilter === 'MINE') {
      return s.currentWaiterId === currentWaiterId;
    }
    return true;
  });

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const selectedTableNumber = selectedSession ? tableMap[selectedSession.tableId] || '?' : null;

  // Categories list
  const categories = ['Todos', ...Array.from(new Set(products.map((p) => p.category || 'General')))];
  const filteredProducts = products.filter((p) => {
    if (selectedCategory === 'Todos') return true;
    return (p.category || 'General') === selectedCategory;
  });

  // Cart operations
  const addToCart = (product: CatalogProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { product, quantity: 1, notes: '' }];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as Array<{ product: CatalogProduct; quantity: number; notes: string }>,
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  // Submit Comanda
  const handleSendToKitchen = async () => {
    if (!selectedSessionId || cart.length === 0) return;
    setMsg(null);

    const payload = {
      restaurantId,
      tableSessionId: selectedSessionId,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.product.price,
        notes: item.notes || undefined,
      })),
    };

    const res = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.data) {
      // Automatically send to kitchen
      await request(`/api/orders/${(res.data as any).id}/send-to-kitchen`, {
        method: 'POST',
      });
      setMsg({ type: 'success', text: `¡Comanda enviada a cocina para Mesa ${selectedTableNumber}!` });
      setCart([]);
      fetchData();
    } else {
      setMsg({ type: 'error', text: res.error || 'Error al enviar comanda' });
    }
  };

  // Handover table
  const handleHandover = async () => {
    if (!selectedSessionId || !targetWaiterId) return;
    const res = await request(`/api/table-sessions/${selectedSessionId}/change-waiter`, {
      method: 'POST',
      body: JSON.stringify({ newWaiterId: targetWaiterId }),
    });
    if (res.data) {
      setMsg({ type: 'success', text: `Mesa traspasada a ${waiterMap[targetWaiterId] || 'otro mozo'}` });
      setIsHandoverOpen(false);
      fetchData();
    } else {
      setMsg({ type: 'error', text: res.error || 'Error en traspaso' });
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary p-4 max-w-[480px] mx-auto relative pb-32">
      {/* Ready Alert Top Toast */}
      {readyAlert && (
        <div className="glass-strong border border-emerald/40 rounded-md p-3 mb-4 flex items-center justify-between shadow-glowEmerald animate-slide-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald text-white flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-emerald">Plato Listo</div>
              <div className="text-sm font-semibold">{readyAlert.text}</div>
            </div>
          </div>
          <button
            onClick={() => setReadyAlert(null)}
            className="h-8 px-3 rounded-pill bg-emerald text-white text-xs font-bold shadow-sm"
          >
            ENTREGAR
          </button>
        </div>
      )}

      {/* Terminal Header */}
      <header className="glass rounded-lg p-3 mb-4 shadow-card">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xs bg-amber text-black flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-text-tertiary">Terminal Mozo</div>
              <h2 className="text-sm font-bold">Mozo: {activeWaiter?.name || 'Atención'}</h2>
            </div>
          </div>

          <div className="flex gap-1">
            {waiters.map((w) => (
              <button
                key={w.id}
                onClick={() => handleSelectWaiterTerminal(w.id)}
                className={`h-7 px-2.5 rounded-pill text-xs font-medium transition ${
                  currentWaiterId === w.id
                    ? 'bg-amber text-black font-bold'
                    : 'bg-surface-2 text-text-secondary hover:text-white'
                }`}
              >
                {w.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
          <div className="flex gap-1.5">
            <button
              onClick={() => setTableFilter('MINE')}
              className={`px-3 py-1 rounded-pill font-medium transition ${
                tableFilter === 'MINE' ? 'bg-white text-black font-bold' : 'text-text-secondary hover:text-white'
              }`}
            >
              Mis Mesas ({sessions.filter((s) => s.currentWaiterId === currentWaiterId).length})
            </button>
            <button
              onClick={() => setTableFilter('ALL')}
              className={`px-3 py-1 rounded-pill font-medium transition ${
                tableFilter === 'ALL' ? 'bg-white text-black font-bold' : 'text-text-secondary hover:text-white'
              }`}
            >
              Todas ({sessions.length})
            </button>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1 text-text-secondary hover:text-white transition"
            title="Refrescar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Mesas Chips Slider */}
      <section className="mb-4">
        <div className="text-[11px] uppercase tracking-widest text-text-tertiary font-semibold mb-2">
          Seleccionar Mesa
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {filteredSessions.length === 0 ? (
            <div className="text-xs text-text-tertiary p-2">Sin mesas activas en esta vista</div>
          ) : (
            filteredSessions.map((session) => {
              const num = tableMap[session.tableId] || '?';
              const isSelected = selectedSessionId === session.id;
              const isMine = session.currentWaiterId === currentWaiterId;

              return (
                <button
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`shrink-0 h-10 px-3.5 rounded-pill flex items-center gap-2 text-xs font-semibold border transition active:scale-95 ${
                    isSelected
                      ? 'bg-amber text-black border-amber shadow-glowAmber'
                      : isMine
                      ? 'bg-surface-2 text-text-primary border-white/10'
                      : 'glass text-text-secondary border-white/5'
                  }`}
                >
                  <span>Mesa {num}</span>
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-black' : isMine ? 'bg-emerald' : 'bg-white/30'}`} />
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Selected Table Actions Bar */}
      {selectedSession && (
        <div className="glass rounded-md p-3 mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold">Mesa {selectedTableNumber}</div>
            <div className="text-[11px] text-text-tertiary">
              Mozo: {waiterMap[selectedSession.currentWaiterId] || 'Asignado'}
            </div>
          </div>
          <button
            onClick={() => setIsHandoverOpen(true)}
            className="h-8 px-3 rounded-pill glass hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5 text-amber"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Traspasar</span>
          </button>
        </div>
      )}

      {/* Handover Modal */}
      {isHandoverOpen && (
        <div className="glass-strong border border-amber/30 rounded-lg p-4 mb-4 shadow-card animate-slide-in">
          <div className="text-sm font-bold mb-2">Traspasar Mesa {selectedTableNumber}</div>
          <p className="text-xs text-text-secondary mb-3">Selecciona el mozo que tomará la atención:</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {waiters
              .filter((w) => w.id !== currentWaiterId)
              .map((w) => (
                <button
                  key={w.id}
                  onClick={() => setTargetWaiterId(w.id)}
                  className={`h-9 px-3 rounded-xs text-xs font-semibold border transition ${
                    targetWaiterId === w.id ? 'bg-amber text-black border-amber' : 'bg-surface-2 border-white/5'
                  }`}
                >
                  {w.name}
                </button>
              ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleHandover}
              disabled={!targetWaiterId}
              className="flex-1 h-9 rounded-pill bg-amber text-black font-bold text-xs disabled:opacity-50"
            >
              Confirmar Traspaso
            </button>
            <button
              onClick={() => setIsHandoverOpen(false)}
              className="h-9 px-4 rounded-pill glass text-xs text-text-secondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      {msg && (
        <div
          className={`p-3 rounded-md mb-4 text-xs font-medium flex items-center gap-2 ${
            msg.type === 'success'
              ? 'bg-emerald/15 border border-emerald/30 text-emerald'
              : 'bg-crimson/15 border border-crimson/30 text-crimson'
          }`}
        >
          {msg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Categories Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setSelectedCategory(c)}
            className={`shrink-0 h-8 px-3.5 rounded-pill text-xs font-medium transition ${
              selectedCategory === c ? 'bg-surface-2 text-white border border-white/20 font-bold' : 'text-text-tertiary hover:text-white'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Product Catalog Grid (2 columns) */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {filteredProducts.map((p) => (
          <button
            key={p.id}
            onClick={() => addToCart(p)}
            className="glass rounded-md p-3 text-left transition active:scale-[0.97] hover:border-white/20 flex flex-col justify-between min-h-[90px] shadow-sm"
          >
            <div>
              <div className="text-xs font-semibold text-text-primary leading-tight line-clamp-2">{p.name}</div>
              {p.description && <div className="text-[10px] text-text-tertiary mt-1 line-clamp-1">{p.description}</div>}
            </div>
            <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5">
              <span className="text-mono text-amber text-xs font-bold">${p.price.toLocaleString()}</span>
              <div className="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center text-xs font-bold">
                +
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Floating Glass Cart Footer Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-[448px] mx-auto glass-strong border border-amber/40 rounded-lg p-3 shadow-2xl z-30 animate-slide-in">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber" />
              <span className="text-xs font-bold">Comanda Mesa {selectedTableNumber}</span>
              <span className="text-[11px] text-text-tertiary">({cart.reduce((a, b) => a + b.quantity, 0)} ítems)</span>
            </div>
            <span className="text-mono text-sm font-bold text-amber">${cartTotal.toLocaleString()}</span>
          </div>

          <div className="max-h-28 overflow-y-auto space-y-1.5 mb-3 pr-1">
            {cart.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between bg-surface-2 rounded-xs px-2.5 py-1.5 text-xs">
                <span className="truncate max-w-[160px] font-medium">{item.product.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-mono text-[11px] text-text-secondary">${(item.product.price * item.quantity).toLocaleString()}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateCartQty(item.product.id, -1)}
                      className="w-5 h-5 rounded bg-white/10 flex items-center justify-center font-bold hover:bg-white/20"
                    >
                      -
                    </button>
                    <span className="w-4 text-center font-mono text-xs">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQty(item.product.id, 1)}
                      className="w-5 h-5 rounded bg-white/10 flex items-center justify-center font-bold hover:bg-white/20"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSendToKitchen}
            className="w-full h-11 rounded-sm bg-amber text-black hover:bg-amber-hover font-bold text-xs flex items-center justify-center gap-2 shadow-glowAmber transition active:scale-[0.98]"
          >
            <Send className="w-4 h-4" />
            <span>ENVIAR A COCINA (${cartTotal.toLocaleString()})</span>
          </button>
        </div>
      )}
    </div>
  );
}
