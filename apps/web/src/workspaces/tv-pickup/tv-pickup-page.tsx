import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAppContext } from '../../hooks/useContextState';
import { useSse } from '../../hooks/useSse';
import {
  Tv,
  Clock,
  Sparkles,
  Flame,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  Volume2,
} from 'lucide-react';

export interface TakeawayOrder {
  id: string;
  code: string; // e.g. #L-45
  customerName?: string;
  status: 'DRAFT' | 'CONFIRMED' | 'SENT_TO_KITCHEN' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
  isPaid: boolean;
  totalAmount: number;
  items: Array<{ productId: string; name?: string; quantity: number; notes?: string }>;
  readyAt?: string;
  createdAt: string;
}

export function TvPickupPage() {
  const { restaurantId, authToken } = useAppContext();
  const { request } = useApi();
  const [orders, setOrders] = useState<TakeawayOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Update digital clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTakeawayOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, kitchenRes, productsRes, customersRes] = await Promise.all([
        request<any[]>(`/api/orders?restaurantId=${restaurantId}`),
        request<any[]>(`/api/kitchen/orders?restaurantId=${restaurantId}`),
        request<any[]>(`/api/catalog/products?restaurantId=${restaurantId}`),
        request<any[]>(`/api/customers?restaurantId=${restaurantId}`),
      ]);

      const productMap = (productsRes.data || []).reduce<Record<string, string>>((acc, p) => {
        acc[p.id] = p.name;
        return acc;
      }, {});

      const customerMap = (customersRes.data || []).reduce<Record<string, string>>((acc, c) => {
        acc[c.id] = c.name;
        return acc;
      }, {});

      const kitchenOrderMap = (kitchenRes.data || []).reduce<Record<string, any>>((acc, k) => {
        acc[k.orderId] = k;
        return acc;
      }, {});

      // Read local codes if available
      const localCodeMap: Record<string, string> = {};
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('restaurant_os_customer_state_')) {
              const parsed = JSON.parse(localStorage.getItem(key) || '{}');
              if (parsed.activePreOrder?.orderId && parsed.activePreOrder?.code) {
                localCodeMap[parsed.activePreOrder.orderId] = parsed.activePreOrder.code;
              }
            }
          }
        } catch {
          // ignore
        }
      }

      const combined: TakeawayOrder[] = [];

      // Display orders that are in active kitchen preparation or ready to be picked up
      if (ordersRes.data) {
        ordersRes.data
          .filter(
            (o) =>
              (o.type === 'TAKEAWAY' || o.type === 'DELIVERY' || !o.tableSessionId || o.tableSessionId === '00000000-0000-0000-0000-000000000000') &&
              o.status !== 'CANCELLED' &&
              o.status !== 'DELIVERED',
          )
          .forEach((o) => {
            const ko = kitchenOrderMap[o.id];
            const effectiveStatus = (ko?.status === 'READY' || o.status === 'READY') ? 'READY' : (o.status || ko?.status || 'PREPARING');

            const shortCode = o.id.replace(/\D/g, '').slice(-2) || '45';
            const code = localCodeMap[o.id] || `#L-${shortCode.padStart(2, '0')}`;

            combined.push({
              id: o.id,
              code,
              customerName: customerMap[o.customerId] || 'Cliente Retiro',
              status: effectiveStatus,
              isPaid: o.isPaid ?? true,
              totalAmount: o.totalAmount || 0,
              items: (o.items || []).map((it: any) => ({
                productId: it.productId,
                name: productMap[it.productId] || it.name || it.productId,
                quantity: it.quantity || 1,
                notes: it.notes,
              })),
              readyAt: o.updatedAt,
              createdAt: o.createdAt,
            });
          });
      }

      setOrders(combined);
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  }, [request, restaurantId]);

  useEffect(() => {
    fetchTakeawayOrders();
  }, [fetchTakeawayOrders]);

  // Real-time SSE synchronization
  useSse({
    token: authToken,
    restaurantId,
    eventTypes: [
      'ORDER_CONFIRMED',
      'ORDER_SENT_TO_KITCHEN',
      'KITCHEN_RECEIVED',
      'KITCHEN_STARTED',
      'ORDER_NEARLY_READY',
      'ORDER_READY',
      'ORDER_DELIVERED',
      'PAYMENT_REGISTERED',
      'ACCOUNT_CLOSED',
    ],
    onEvent: () => {
      fetchTakeawayOrders();
    },
    onReconnect: () => {
      fetchTakeawayOrders();
    },
  });

  // Mark delivered at pickup counter (cleans from TV screen!)
  const handleDeliver = async (orderId: string) => {
    await request(`/api/orders/${orderId}/deliver`, { method: 'POST' });
    fetchTakeawayOrders();
  };

  const preparingOrders = orders.filter(
    (o) => o.status !== 'READY' && o.status !== 'DELIVERED' && o.status !== 'CANCELLED',
  );

  const readyOrders = orders.filter((o) => o.status === 'READY');

  return (
    <div className="min-h-screen bg-[#07090E] text-white p-4 lg:p-8 flex flex-col justify-between select-none">
      {/* Top TV Header Bar */}
      <header className="glass-strong border border-white/10 rounded-2xl p-5 mb-8 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber text-black flex items-center justify-center font-extrabold shadow-glowAmber">
            <Tv className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight uppercase">Barra de Retiro / Takeaway</h1>
              <span className="px-3 py-0.5 rounded-pill bg-amber/20 text-amber text-xs font-mono font-bold border border-amber/40">
                PANTALLA PÚBLICA TV
              </span>
            </div>
            <p className="text-sm text-text-tertiary">Mira tu número en pantalla y retira en el mostrador</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right font-mono">
            <div className="text-xs text-text-tertiary uppercase tracking-widest font-bold">Hora Actual</div>
            <div className="text-2xl font-black text-amber">{currentTime || '--:--:--'}</div>
          </div>

          <button
            onClick={fetchTakeawayOrders}
            disabled={loading}
            className="w-10 h-10 rounded-full glass flex items-center justify-center text-text-secondary hover:text-white transition active:scale-95 cursor-pointer"
            title="Refrescar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Split Columns: EN PREPARACIÓN vs LISTO PARA RETIRAR */}
      <main className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 items-stretch">
        {/* Left Column: EN PREPARACIÓN */}
        <section className="rounded-2xl bg-surface-1/60 border border-white/5 p-6 flex flex-col shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                <Flame className="w-5 h-5 animate-pulse" />
              </div>
              <h2 className="text-xl font-extrabold uppercase tracking-wider text-text-secondary">
                En Preparación ({preparingOrders.length})
              </h2>
            </div>
            <span className="text-xs font-mono text-text-tertiary">Cocina caliente</span>
          </div>

          {preparingOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary py-12 gap-3">
              <Clock className="w-12 h-12 opacity-20" />
              <span className="text-base font-medium">No hay pedidos en cocción</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 auto-rows-max">
              {preparingOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-xl bg-surface-2/80 border border-white/10 p-4 text-center shadow-md flex flex-col items-center justify-center min-h-[100px] animate-fade-in"
                >
                  <span className="text-2xl font-black font-mono tracking-wider text-text-primary">
                    {ord.code}
                  </span>
                  <span className="text-xs font-semibold text-text-secondary truncate max-w-[120px] mt-0.5">
                    {ord.customerName}
                  </span>
                  <span className="text-[11px] font-mono text-orange-400 font-semibold mt-1">
                    Cocinando...
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: ✨ LISTO PARA RETIRAR (GIANT CALLOUT CARDS) */}
        <section className="rounded-2xl bg-emerald/10 border-2 border-emerald/40 p-6 flex flex-col shadow-glowEmerald backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-emerald/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald text-white flex items-center justify-center font-bold shadow-lg">
                <Sparkles className="w-5 h-5 animate-spin" />
              </div>
              <h2 className="text-xl font-extrabold uppercase tracking-wider text-emerald">
                ¡Listo para Retirar! ({readyOrders.length})
              </h2>
            </div>
            <span className="text-xs font-mono font-bold text-emerald uppercase tracking-wider animate-pulse">
              Acercarse a Barra
            </span>
          </div>

          {readyOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-emerald/40 py-12 gap-3">
              <ShoppingBag className="w-12 h-12 opacity-30" />
              <span className="text-base font-medium">Esperando llamados de cocina</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 auto-rows-max">
              {readyOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-2xl bg-gradient-to-br from-emerald/20 to-surface-2 border-2 border-emerald text-white p-5 shadow-2xl flex flex-col justify-between min-h-[140px] relative group animate-slide-in"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-4xl font-black font-mono tracking-tight text-white drop-shadow-md">
                        {ord.code}
                      </span>
                      <div className="text-sm font-bold text-emerald-300">
                        {ord.customerName}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-pill bg-emerald text-black text-xs font-black uppercase tracking-wider shadow-sm">
                      LISTO ✓
                    </span>
                  </div>

                  <div className="my-2">
                    <div className="text-xs text-emerald-200 font-semibold truncate">
                      {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                    </div>
                    <div className="text-[11px] text-amber font-mono font-bold mt-1">
                      ⚠️ RETIRAR EN BARRA - SE ENFRÍA
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeliver(ord.id)}
                    className="w-full h-9 rounded-xl bg-white text-black hover:bg-white/90 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md mt-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald" />
                    <span>Entregar al Cliente</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer Banner */}
      <footer className="mt-8 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between text-xs text-text-tertiary font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald animate-ping" />
          <span>Sincronización en vivo con Barra & Cocina KDS</span>
        </div>
        <div>Restaurant OS • Sistema de Barra TV Retiro</div>
      </footer>
    </div>
  );
}
