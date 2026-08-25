import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAppContext } from '../../hooks/useContextState';
import { useSse } from '../../hooks/useSse';
import {
  Clock,
  RefreshCw,
  ChefHat,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Utensils,
  Layers,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

export interface KitchenItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  notes?: string;
  sector?: string;
}

export interface KitchenTicket {
  id: string;
  kitchenOrderId: string;
  orderId: string;
  ticketCode: string;
  sector: string;
  restaurantId: string;
  tableNumber?: number | null;
  channel: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  status: 'RECEIVED' | 'STARTED' | 'NEARLY_READY' | 'READY' | 'COMPLETED' | 'CANCELLED';
  items: KitchenItem[];
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  receivedAt: string;
  startedAt?: string;
  readyAt?: string;
  notes?: string;
}

const SECTOR_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  TODOS: { label: 'Todos los Sectores', icon: '⚡', color: 'text-amber', bg: 'bg-amber/15 border-amber/30' },
  PIZZAS: { label: 'Pizzas & Cocina', icon: '🍕', color: 'text-amber', bg: 'bg-amber/15 border-amber/30' },
  BEBIDAS: { label: 'Barra & Bebidas', icon: '🥤', color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30' },
  HELADOS: { label: 'Postres & Helados', icon: '🍨', color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30' },
  CAFE: { label: 'Cafetería', icon: '☕', color: 'text-yellow-600', bg: 'bg-yellow-600/15 border-yellow-600/30' },
};

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
  const isDanger = elapsed > 900; // > 15 min
  const isWarning = elapsed > 600; // > 10 min

  let badgeClass = 'bg-surface-2 text-text-secondary border border-white/10';
  if (isDanger) {
    badgeClass = 'bg-crimson text-white border-crimson animate-pulse';
  } else if (isWarning) {
    badgeClass = 'bg-amber text-black border-amber font-bold';
  }

  return (
    <span className={`text-mono px-2.5 py-1 rounded-pill text-xs font-bold transition-all ${badgeClass}`}>
      ⏱️ {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

export function KitchenPage() {
  const { restaurantId, authToken } = useAppContext();
  const { request } = useApi();
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>('TODOS');
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
    try {
      const [koRes, ordersRes, tablesRes, sessionsRes, prodsRes] = await Promise.all([
        request<any[]>(`/api/kitchen/orders?restaurantId=${restaurantId}`),
        request<any[]>(`/api/orders?restaurantId=${restaurantId}`),
        request<any[]>(`/api/tables?restaurantId=${restaurantId}`),
        request<any[]>(`/api/table-sessions?restaurantId=${restaurantId}`),
        request<any[]>(`/api/catalog/products?restaurantId=${restaurantId}`),
      ]);

      const productMap = (prodsRes.data || []).reduce<Record<string, { name: string; sector: string }>>((acc, p) => {
        acc[p.id] = { name: p.name, sector: p.sectorKDS || 'PIZZAS' };
        return acc;
      }, {});

      const tableMap = (tablesRes.data || []).reduce<Record<string, number>>((acc, t) => {
        acc[t.id] = t.number;
        return acc;
      }, {});

      const sessionTableMap = (sessionsRes.data || []).reduce<Record<string, number>>((acc, s) => {
        acc[s.id] = tableMap[s.tableId] || 1;
        return acc;
      }, {});

      const orderMap = (ordersRes.data || []).reduce<Record<string, any>>((acc, o) => {
        acc[o.id] = o;
        return acc;
      }, {});

      if (koRes.data) {
        const generatedTickets: KitchenTicket[] = [];

        for (const ko of koRes.data) {
          const rawOrder = orderMap[ko.orderId];
          const tableNum = rawOrder?.tableSessionId ? sessionTableMap[rawOrder.tableSessionId] || null : null;
          const channel: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' = rawOrder?.type || 'DINE_IN';

          let parsedMeta: any = null;
          if (ko.notes) {
            try {
              parsedMeta = JSON.parse(ko.notes);
            } catch {
              // regular note
            }
          }

          if (parsedMeta && Array.isArray(parsedMeta.tickets) && parsedMeta.tickets.length > 0) {
            // Multiple partitioned sector tickets
            for (const t of parsedMeta.tickets) {
              const ticketItems: KitchenItem[] = (t.items || []).map((it: any) => ({
                id: it.productId || crypto.randomUUID(),
                productId: it.productId,
                name: productMap[it.productId]?.name || it.name || it.productId || 'Plato',
                quantity: it.quantity || 1,
                notes: it.notes || undefined,
                sector: t.sector,
              }));

              const rawStatus = String(t.status || ko.status || rawOrder?.status || 'RECEIVED').toUpperCase();
              let normalizedStatus: 'RECEIVED' | 'STARTED' | 'NEARLY_READY' | 'READY' | 'COMPLETED' = 'RECEIVED';
              if (rawStatus === 'STARTED' || rawStatus === 'PREPARING' || rawStatus === 'IN_PREPARATION') {
                normalizedStatus = 'STARTED';
              } else if (rawStatus === 'NEARLY_READY') {
                normalizedStatus = 'NEARLY_READY';
              } else if (rawStatus === 'READY') {
                normalizedStatus = 'READY';
              } else if (rawStatus === 'COMPLETED' || rawStatus === 'DELIVERED') {
                normalizedStatus = 'COMPLETED';
              } else {
                normalizedStatus = 'RECEIVED';
              }

              generatedTickets.push({
                id: `${ko.id}-${t.sector}`,
                kitchenOrderId: ko.id,
                orderId: ko.orderId,
                ticketCode: t.ticketCode || `T-M${tableNum ?? 'ORD'}-01-${t.sector}`,
                sector: t.sector || 'PIZZAS',
                restaurantId: ko.restaurantId,
                tableNumber: tableNum,
                channel,
                status: normalizedStatus,
                items: ticketItems,
                priority: (ko.priority > 0 ? 'URGENT' : 'NORMAL') as any,
                receivedAt: ko.receivedAt || ko.createdAt || new Date().toISOString(),
                startedAt: ko.startedAt,
                readyAt: ko.readyAt,
                notes: parsedMeta.userNotes || undefined,
              });
            }
          } else {
            // Single ticket
            const items: KitchenItem[] = (rawOrder?.items || []).map((it: any) => ({
              id: it.productId || crypto.randomUUID(),
              productId: it.productId,
              name: productMap[it.productId]?.name || it.productId || 'Plato',
              quantity: it.quantity || 1,
              notes: it.notes || undefined,
              sector: productMap[it.productId]?.sector || ko.sector || 'PIZZAS',
            }));

            const sector = ko.sector || 'PIZZAS';
            const tableLabel = tableNum ? `M${tableNum}` : (channel === 'TAKEAWAY' ? 'L-45' : 'ORD');

            const rawStatus = String(ko.status || rawOrder?.status || 'RECEIVED').toUpperCase();
            let normalizedStatus: 'RECEIVED' | 'STARTED' | 'NEARLY_READY' | 'READY' | 'COMPLETED' = 'RECEIVED';
            if (rawStatus === 'STARTED' || rawStatus === 'PREPARING' || rawStatus === 'IN_PREPARATION') {
              normalizedStatus = 'STARTED';
            } else if (rawStatus === 'NEARLY_READY') {
              normalizedStatus = 'NEARLY_READY';
            } else if (rawStatus === 'READY') {
              normalizedStatus = 'READY';
            } else if (rawStatus === 'COMPLETED' || rawStatus === 'DELIVERED') {
              normalizedStatus = 'COMPLETED';
            } else {
              normalizedStatus = 'RECEIVED';
            }

            generatedTickets.push({
              id: ko.id,
              kitchenOrderId: ko.id,
              orderId: ko.orderId,
              ticketCode: ko.ticketCode || `T-${tableLabel}-01-${sector}`,
              sector,
              restaurantId: ko.restaurantId,
              tableNumber: tableNum,
              channel,
              status: normalizedStatus,
              items,
              priority: (ko.priority > 0 ? 'URGENT' : 'NORMAL') as any,
              receivedAt: ko.receivedAt || ko.createdAt || new Date().toISOString(),
              startedAt: ko.startedAt,
              readyAt: ko.readyAt,
              notes: typeof ko.notes === 'string' && !parsedMeta ? ko.notes : parsedMeta?.userNotes,
            });
          }
        }

        setTickets(generatedTickets);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, [request, restaurantId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real-time SSE refresh & snapshot on reconnect
  useSse({
    token: authToken,
    eventTypes: [
      'ORDER_SENT_TO_KITCHEN',
      'KITCHEN_RECEIVED',
      'KITCHEN_STARTED',
      'ORDER_NEARLY_READY',
      'ORDER_READY',
      'ORDER_DELIVERED',
      'ORDER_CANCELLED',
      'TABLE_CHANGED',
    ],
    onEvent: () => {
      fetchOrders();
    },
    onReconnect: () => {
      fetchOrders();
    },
  });

  const handleStatusTransition = async (kitchenOrderId: string, action: 'start' | 'nearly-ready' | 'ready' | 'complete') => {
    setActionError(null);
    const res = await request(`/api/kitchen/orders/${kitchenOrderId}/${action}`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (res.error) {
      setActionError(res.error);
    } else {
      fetchOrders();
    }
  };

  // Filter tickets by selected sector
  const filteredTickets = useMemo(() => {
    if (selectedSector === 'TODOS') return tickets;
    return tickets.filter((t) => t.sector.toUpperCase() === selectedSector.toUpperCase());
  }, [tickets, selectedSector]);

  // Batching aggregation across all active tickets in view (RECEIVED, STARTED, NEARLY_READY)
  const activeBatches = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of filteredTickets) {
      if (t.status === 'RECEIVED' || t.status === 'STARTED' || t.status === 'NEARLY_READY') {
        for (const item of t.items) {
          counts[item.name] = (counts[item.name] || 0) + item.quantity;
        }
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredTickets]);

  const receivedTickets = filteredTickets.filter((o) => o.status === 'RECEIVED');
  const startedTickets = filteredTickets.filter((o) => o.status === 'STARTED' || o.status === 'NEARLY_READY');
  const readyTickets = filteredTickets.filter((o) => o.status === 'READY');

  const columns = [
    { key: 'RECEIVED', title: 'Recibido', count: receivedTickets.length, items: receivedTickets, color: 'text-text-secondary' },
    { key: 'STARTED', title: 'En Preparación', count: startedTickets.length, items: startedTickets, color: 'text-amber' },
    { key: 'READY', title: 'Listo para Servir', count: readyTickets.length, items: readyTickets, color: 'text-emerald' },
  ];

  const sectorList = ['TODOS', 'PIZZAS', 'BEBIDAS', 'HELADOS', 'CAFE'];

  return (
    <div className="min-h-screen bg-background text-text-primary p-4 lg:p-6 selection:bg-amber/30 selection:text-white">
      {/* Header Sticky Glass */}
      <header className="glass sticky top-0 z-20 rounded-lg px-5 py-3 flex flex-wrap items-center justify-between gap-4 mb-4 shadow-card">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-sm bg-amber text-black flex items-center justify-center font-bold shadow-glowAmber">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight">Cocina KDS Multi-Sector</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-pill bg-amber/20 text-amber border border-amber/30">
                FASE 2.2 FAN-OUT & BATCHING
              </span>
            </div>
            <p className="text-xs text-text-tertiary">Partición automática de tickets y despacho agrupado</p>
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

      {/* Sector Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4">
        {sectorList.map((sec) => {
          const cfg = SECTOR_CONFIG[sec] || { label: sec, icon: '🏷️', color: 'text-text-primary', bg: 'bg-white/10' };
          const count = sec === 'TODOS' ? tickets.length : tickets.filter((t) => t.sector.toUpperCase() === sec).length;
          const isSelected = selectedSector === sec;

          return (
            <button
              key={sec}
              onClick={() => setSelectedSector(sec)}
              className={`px-4 py-2.5 rounded-pill text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap shadow-sm ${
                isSelected
                  ? 'bg-amber text-black shadow-glowAmber scale-105'
                  : 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-white border border-white/5'
              }`}
            >
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
              <span className={`px-2 py-0.5 rounded-pill text-[10px] font-mono font-extrabold ${isSelected ? 'bg-black/20 text-black' : 'bg-white/10 text-text-tertiary'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Batch Summary Bar */}
      {activeBatches.length > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-surface-2 border border-amber/30 shadow-card flex flex-wrap items-center justify-between gap-3 animate-slide-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-amber/20 text-amber flex items-center justify-center font-bold">
              <Flame className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-amber flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                <span>Batch Activo en Cocina ({selectedSector})</span>
              </div>
              <p className="text-[11px] text-text-tertiary">Agrupación en tiempo real para optimizar despacho</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeBatches.map(([itemName, qty]) => (
              <span
                key={itemName}
                className="px-3 py-1 rounded-pill bg-white/5 border border-white/10 text-xs font-bold flex items-center gap-1.5 text-text-primary hover:border-amber/40 transition"
              >
                <span className="text-amber font-mono font-extrabold text-sm">{qty}x</span>
                <span>{itemName}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {actionError && (
        <div className="mb-6 p-4 rounded-md bg-crimson/15 border border-crimson/30 text-crimson flex items-center gap-3 animate-slide-in">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{actionError}</span>
        </div>
      )}

      {/* Kanban Board with Partitioned Tickets */}
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
                col.items.map((ticket) => {
                  const isStarted = ticket.status === 'STARTED' || ticket.status === 'NEARLY_READY';
                  const isReady = ticket.status === 'READY';
                  const sectorCfg = SECTOR_CONFIG[ticket.sector] || { icon: '🏷️', color: 'text-amber', bg: 'bg-amber/15 border-amber/30' };

                  return (
                    <article
                      key={ticket.id}
                      className={`rounded-md p-4 transition-all duration-200 hover:scale-[1.01] shadow-card ${
                        isReady
                          ? 'bg-emerald/10 border border-emerald/30'
                          : isStarted
                          ? 'bg-surface-2 border border-amber/30'
                          : 'bg-surface-2 border border-white/10'
                      }`}
                    >
                      {/* Ticket Header & Ticket Code */}
                      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-white/5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xs bg-white text-black font-extrabold text-xs flex items-center justify-center shadow-sm">
                            {ticket.tableNumber ? `M${ticket.tableNumber}` : '🛍️'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black font-mono tracking-tight text-white">
                                {ticket.ticketCode}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-pill border ${sectorCfg.bg} ${sectorCfg.color}`}>
                                {sectorCfg.icon} {ticket.sector}
                              </span>
                            </div>
                            <div className="text-[11px] text-text-tertiary mt-0.5 flex items-center gap-2">
                              <span>{ticket.channel === 'DINE_IN' ? `Salón • Mesa ${ticket.tableNumber ?? '?'}` : 'Takeaway • Para Retiro'}</span>
                            </div>
                          </div>
                        </div>

                        <ElapsedTimer receivedAt={ticket.receivedAt} />
                      </div>

                      {/* Items List */}
                      <div className="space-y-2 mb-4">
                        {(ticket.items || []).map((item) => (
                          <div key={item.id} className="rounded-xs bg-white/[0.03] border border-white/5 p-2.5">
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-sm font-semibold text-text-primary">
                                <span className="text-amber font-mono font-bold">{item.quantity}x</span> {item.name}
                              </span>
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-text-secondary">
                                x{item.quantity}
                              </span>
                            </div>
                            {item.notes && (
                              <div className="mt-1.5 text-xs text-amber bg-amber/10 border border-amber/20 rounded-xs px-2 py-1 italic font-medium">
                                ⚠ {item.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Order General Notes */}
                      {ticket.notes && (
                        <div className="mb-4 text-xs text-text-secondary bg-surface-1 border border-white/5 rounded-xs p-2 italic">
                          💬 Nota: {ticket.notes}
                        </div>
                      )}

                      {/* Action Buttons (Ergonomic 52px height for kitchen tablets) */}
                      <div className="pt-1">
                        {ticket.status === 'RECEIVED' && (
                          <button
                            onClick={() => handleStatusTransition(ticket.kitchenOrderId, 'start')}
                            className="w-full h-[52px] rounded-sm bg-amber text-black hover:bg-amber-hover font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-glowAmber"
                          >
                            <Flame className="w-4 h-4" />
                            <span>COCINAR AHORA</span>
                          </button>
                        )}

                        {ticket.status === 'STARTED' && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleStatusTransition(ticket.kitchenOrderId, 'nearly-ready')}
                              className="h-[52px] rounded-sm glass hover:bg-white/10 text-xs font-semibold text-amber transition active:scale-[0.98]"
                            >
                              CASI LISTO
                            </button>
                            <button
                              onClick={() => handleStatusTransition(ticket.kitchenOrderId, 'ready')}
                              className="h-[52px] rounded-sm bg-emerald text-white hover:bg-emerald-muted font-bold text-sm flex items-center justify-center gap-1.5 transition active:scale-[0.98] shadow-glowEmerald"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>LISTO ✓</span>
                            </button>
                          </div>
                        )}

                        {ticket.status === 'NEARLY_READY' && (
                          <button
                            onClick={() => handleStatusTransition(ticket.kitchenOrderId, 'ready')}
                            className="w-full h-[52px] rounded-sm bg-emerald text-white hover:bg-emerald-muted font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-glowEmerald"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>MARCAR LISTO ✓</span>
                          </button>
                        )}

                        {ticket.status === 'READY' && (
                          <button
                            onClick={() => handleStatusTransition(ticket.kitchenOrderId, 'complete')}
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
