import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAppContext } from '../../hooks/useContextState';
import { useSse } from '../../hooks/useSse';
import { Clock, RefreshCw, ChefHat, AlertTriangle, CheckCircle2, Flame, Utensils } from 'lucide-react';

export interface KitchenItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
}

export interface KitchenOrder {
  id: string;
  orderId: string;
  restaurantId: string;
  tableNumber: number;
  status: 'RECEIVED' | 'STARTED' | 'NEARLY_READY' | 'READY' | 'COMPLETED' | 'CANCELLED';
  items: KitchenItem[];
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  receivedAt: string;
  startedAt?: string;
  readyAt?: string;
}

function useElapsed(receivedAt: string) {
  const getSec = useCallback(() => {
    const start = new Date(receivedAt).getTime();
    if (isNaN(start)) return 0;
    return Math.max(0, Math.floor((Date.now() - start) / 1000));
  }, [receivedAt]);

  const [sec, setSec] = useState<number>(getSec);

  useEffect(() => {
    setSec(getSec());
    const interval = setInterval(() => setSec(getSec()), 1000);
    return () => clearInterval(interval);
  }, [getSec]);

  return sec;
}

function ElapsedTimer({ receivedAt }: { receivedAt: string }) {
  const elapsed = useElapsed(receivedAt);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const isDanger = elapsed > 900;  // > 15 min
  const isWarning = elapsed > 600; // > 10 min

  let badgeClass = 'bg-surface-2 text-text-secondary border border-white/10';
  if (isDanger) {
    badgeClass = 'bg-crimson text-white border-crimson animate-pulse-danger';
  } else if (isWarning) {
    badgeClass = 'bg-orange text-white border-orange animate-pulse-warning';
  }

  return (
    <span className={`text-mono px-2.5 py-1 rounded-pill text-xs font-bold transition-all ${badgeClass}`}>
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

export function KitchenPage() {
  const { restaurantId, authToken } = useAppContext();
  const { request } = useApi();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [timeString, setTimeString] = useState('');

  // Clock
  useEffect(() => {
    const updateTime = () => {
      setTimeString(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const res = await request<KitchenOrder[]>(`/api/kitchen/orders?restaurantId=${restaurantId}`);
    if (res.data) {
      setOrders(res.data);
    }
    setLoading(false);
  }, [request, restaurantId]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Real-time SSE refresh
  useSse({
    token: authToken,
    eventTypes: ['ORDER_SENT_TO_KITCHEN', 'KITCHEN_ORDER_STARTED', 'KITCHEN_ORDER_NEARLY_READY', 'ORDER_READY', 'ORDER_DELIVERED'],
    onEvent: () => {
      fetchOrders();
    },
  });

  const handleStatusTransition = async (orderId: string, action: 'start' | 'nearly-ready' | 'ready' | 'complete') => {
    setActionError(null);
    const res = await request(`/api/kitchen/orders/${orderId}/${action}`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (res.error) {
      setActionError(res.error);
    } else {
      fetchOrders();
    }
  };

  const receivedOrders = orders.filter((o) => o.status === 'RECEIVED');
  const startedOrders = orders.filter((o) => o.status === 'STARTED' || o.status === 'NEARLY_READY');
  const readyOrders = orders.filter((o) => o.status === 'READY');

  const columns = [
    { key: 'RECEIVED', title: 'Recibido', count: receivedOrders.length, items: receivedOrders, color: 'text-text-secondary' },
    { key: 'STARTED', title: 'En Preparación', count: startedOrders.length, items: startedOrders, color: 'text-amber' },
    { key: 'READY', title: 'Listo para Servir', count: readyOrders.length, items: readyOrders, color: 'text-emerald' },
  ];

  return (
    <div className="min-h-screen bg-background text-text-primary p-4 lg:p-6 selection:bg-amber/30 selection:text-white">
      {/* Header Sticky Glass */}
      <header className="glass sticky top-0 z-20 rounded-lg px-5 h-[64px] flex items-center justify-between mb-6 shadow-card">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-sm bg-amber text-black flex items-center justify-center font-bold shadow-glowAmber">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Cocina KDS</h1>
            <p className="text-xs text-text-tertiary">Kitchen Display System en tiempo real</p>
          </div>
        </div>

        {/* Counter Badges */}
        <div className="hidden md:flex items-center gap-3">
          {columns.map((col) => (
            <div key={col.key} className="flex items-center gap-2 px-3 py-1.5 rounded-pill bg-surface-2 border border-white/5">
              <span className={`text-[11px] uppercase tracking-widest font-semibold ${col.color}`}>{col.title}</span>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-pill bg-white/10">{col.count}</span>
            </div>
          ))}
        </div>

        {/* Clock & Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-mono text-sm text-text-secondary bg-surface-1 px-3 py-1.5 rounded-pill border border-white/5">
            <Clock className="w-4 h-4 text-amber" />
            <span>{timeString || '12:00:00'}</span>
          </div>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="h-9 px-3 rounded-pill glass hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
            title="Refrescar órdenes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refrescar</span>
          </button>
        </div>
      </header>

      {actionError && (
        <div className="mb-6 p-4 rounded-md bg-crimson/15 border border-crimson/30 text-crimson flex items-center gap-3 animate-slide-in">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{actionError}</span>
        </div>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
        {columns.map((col) => (
          <section key={col.key} className="rounded-lg bg-surface-1 border border-white/5 p-4 flex flex-col min-h-[550px]">
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className={`text-xs uppercase tracking-wider font-bold ${col.color}`}>{col.title}</span>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-pill bg-surface-2 text-text-primary">
                  {col.count}
                </span>
              </div>
            </div>

            {/* Column Cards */}
            <div className="space-y-4 flex-1">
              {col.items.length === 0 ? (
                <div className="h-48 border border-dashed border-white/10 rounded-md flex flex-col items-center justify-center text-text-tertiary gap-2">
                  <Utensils className="w-6 h-6 opacity-40" />
                  <span className="text-xs">Sin pedidos en esta estación</span>
                </div>
              ) : (
                col.items.map((order) => {
                  const isStarted = order.status === 'STARTED' || order.status === 'NEARLY_READY';
                  const isReady = order.status === 'READY';

                  return (
                    <article
                      key={order.id}
                      className={`rounded-md p-4 transition-all duration-200 hover:scale-[1.01] shadow-card ${
                        isReady
                          ? 'bg-emerald/10 border border-emerald/30'
                          : isStarted
                          ? 'bg-surface-2 border border-amber/30'
                          : 'bg-surface-2 border border-white/10'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-white/5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xs bg-white text-black font-bold text-xs flex items-center justify-center shadow-sm">
                            M{order.tableNumber}
                          </div>
                          <div>
                            <div className="text-sm font-bold leading-none">Mesa {order.tableNumber}</div>
                            <div className="text-[11px] text-text-tertiary text-mono mt-0.5">
                              ID: #{order.id.slice(0, 6)}
                            </div>
                          </div>
                        </div>

                        <ElapsedTimer receivedAt={order.receivedAt} />
                      </div>

                      {/* Items List */}
                      <div className="space-y-2 mb-4">
                        {order.items.map((item) => (
                          <div key={item.id} className="rounded-xs bg-white/[0.03] border border-white/5 p-2.5">
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-sm font-semibold text-text-primary">
                                {item.quantity}x {item.name}
                              </span>
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-text-secondary">
                                x{item.quantity}
                              </span>
                            </div>
                            {item.notes && (
                              <div className="mt-1.5 text-xs text-amber-hover bg-amber/10 border border-amber/15 rounded-xs px-2 py-1 italic font-medium">
                                ⚠ {item.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Action Buttons (Ergonomic 56px height for kitchen tablets) */}
                      <div className="pt-1">
                        {order.status === 'RECEIVED' && (
                          <button
                            onClick={() => handleStatusTransition(order.id, 'start')}
                            className="w-full h-[52px] rounded-sm bg-amber text-black hover:bg-amber-hover font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-glowAmber"
                          >
                            <Flame className="w-4 h-4" />
                            <span>COCINAR AHORA</span>
                          </button>
                        )}

                        {order.status === 'STARTED' && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleStatusTransition(order.id, 'nearly-ready')}
                              className="h-[52px] rounded-sm glass hover:bg-white/10 text-xs font-semibold text-amber transition active:scale-[0.98]"
                            >
                              CASI LISTO
                            </button>
                            <button
                              onClick={() => handleStatusTransition(order.id, 'ready')}
                              className="h-[52px] rounded-sm bg-emerald text-white hover:bg-emerald-muted font-bold text-sm flex items-center justify-center gap-1.5 transition active:scale-[0.98] shadow-glowEmerald"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>LISTO ✓</span>
                            </button>
                          </div>
                        )}

                        {order.status === 'NEARLY_READY' && (
                          <button
                            onClick={() => handleStatusTransition(order.id, 'ready')}
                            className="w-full h-[52px] rounded-sm bg-emerald text-white hover:bg-emerald-muted font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-glowEmerald"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>MARCAR LISTO ✓</span>
                          </button>
                        )}

                        {order.status === 'READY' && (
                          <button
                            onClick={() => handleStatusTransition(order.id, 'complete')}
                            className="w-full h-[52px] rounded-sm glass-strong hover:bg-white/10 text-text-secondary text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98]"
                          >
                            <span>DESPACHADO / COMPLETADO</span>
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
