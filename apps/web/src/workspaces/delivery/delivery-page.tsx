import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAppContext } from '../../hooks/useContextState';
import { useSse } from '../../hooks/useSse';
import {
  Bike,
  Navigation,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  DollarSign,
  PackageCheck,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export interface DeliveryOrder {
  id: string;
  code: string; // e.g. #D-45
  status: 'SENT_TO_KITCHEN' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
  isPaid: boolean;
  totalAmount: number;
  deliveryAddress: string;
  customerName: string;
  customerPhone?: string;
  inTransit?: boolean;
  items: Array<{ productId: string; name?: string; quantity: number; notes?: string }>;
  createdAt: string;
}

export function DeliveryPage() {
  const { restaurantId, authToken } = useAppContext();
  const { request } = useApi();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'READY' | 'IN_TRANSIT' | 'DELIVERED'>('READY');
  const [inTransitIds, setInTransitIds] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDeliveryOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, productsRes] = await Promise.all([
        request<any[]>(`/api/orders?restaurantId=${restaurantId}`),
        request<any[]>(`/api/catalog/products?restaurantId=${restaurantId}`),
      ]);

      const productMap = (productsRes.data || []).reduce<Record<string, string>>((acc, p) => {
        acc[p.id] = p.name;
        return acc;
      }, {});

      if (ordersRes.data) {
        const deliveryOrders: DeliveryOrder[] = ordersRes.data
          .filter((o) => o.type === 'DELIVERY' || o.id.includes('deliv'))
          .map((o) => {
            const shortCode = o.id.length >= 2 ? o.id.replace(/[^a-zA-Z0-9]/g, '').slice(-2).toUpperCase() || '45' : '45';
            return {
              id: o.id,
              code: `#D-${shortCode}`,
              status: o.status,
              isPaid: o.isPaid ?? true,
              totalAmount: o.totalAmount || 0,
              deliveryAddress: o.deliveryAddress || 'Av. Corrientes 1234, CABA',
              customerName: o.customerName || 'Cliente Delivery',
              customerPhone: o.customerPhone || '+54 9 11 5555-4321',
              items: (o.items || []).map((it: any) => ({
                productId: it.productId,
                name: productMap[it.productId] || it.name || it.productId,
                quantity: it.quantity || 1,
                notes: it.notes,
              })),
              createdAt: o.createdAt,
            };
          });

        setOrders(deliveryOrders);
      }
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  }, [request, restaurantId]);

  useEffect(() => {
    fetchDeliveryOrders();
  }, [fetchDeliveryOrders]);

  // Real-time SSE updates
  useSse({
    token: authToken,
    eventTypes: [
      'ORDER_SENT_TO_KITCHEN',
      'ORDER_READY',
      'ORDER_DELIVERED',
      'PAYMENT_REGISTERED',
    ],
    onEvent: () => {
      fetchDeliveryOrders();
    },
    onReconnect: () => {
      fetchDeliveryOrders();
    },
  });

  // Start delivery trip
  const handleStartTransit = (orderId: string) => {
    setInTransitIds((prev) => new Set(prev).add(orderId));
    setActiveTab('IN_TRANSIT');
    setMsg({ type: 'success', text: '🛵 Reparto iniciado. ¡Buen viaje!' });
  };

  // Confirm delivery at doorstep
  const handleConfirmDelivery = async (orderId: string) => {
    setMsg(null);
    const res = await request(`/api/orders/${orderId}/deliver`, { method: 'POST' });
    if (res.data) {
      setInTransitIds((prev) => {
        const copy = new Set(prev);
        copy.delete(orderId);
        return copy;
      });
      setMsg({ type: 'success', text: '✅ Pedido entregado y cobrado en destino exitosamente.' });
      fetchDeliveryOrders();
    } else {
      setMsg({ type: 'error', text: res.error || 'Error al confirmar entrega' });
    }
  };

  const readyList = orders.filter((o) => (o.status === 'READY' || o.status === 'PREPARING' || o.status === 'SENT_TO_KITCHEN') && !inTransitIds.has(o.id));
  const inTransitList = orders.filter((o) => inTransitIds.has(o.id));
  const deliveredList = orders.filter((o) => o.status === 'DELIVERED');

  return (
    <div className="min-h-screen bg-background text-text-primary p-4 lg:p-6 max-w-[600px] mx-auto pb-24">
      {/* Header */}
      <header className="glass sticky top-0 z-20 rounded-lg p-4 flex items-center justify-between mb-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-amber text-black flex items-center justify-center font-bold shadow-glowAmber">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Repartidor (Delivery)</h1>
            <p className="text-xs text-text-tertiary">Gestión de envíos y confirmación en domicilio</p>
          </div>
        </div>

        <button
          onClick={fetchDeliveryOrders}
          disabled={loading}
          className="h-9 px-3 rounded-pill glass hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
          title="Refrescar"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refrescar</span>
        </button>
      </header>

      {/* Messages */}
      {msg && (
        <div
          className={`p-3.5 rounded-md mb-4 text-xs font-medium flex items-center gap-2.5 shadow-card animate-slide-in ${
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
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setActiveTab('READY')}
          className={`flex-1 h-10 rounded-pill text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'READY'
              ? 'bg-amber text-black shadow-glowAmber'
              : 'glass text-text-secondary hover:text-white'
          }`}
        >
          <span>Para Salir</span>
          <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">{readyList.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('IN_TRANSIT')}
          className={`flex-1 h-10 rounded-pill text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'IN_TRANSIT'
              ? 'bg-amber text-black shadow-glowAmber'
              : 'glass text-text-secondary hover:text-white'
          }`}
        >
          <span>En Camino</span>
          <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">{inTransitList.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('DELIVERED')}
          className={`flex-1 h-10 rounded-pill text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'DELIVERED'
              ? 'bg-emerald text-white shadow-glowEmerald'
              : 'glass text-text-secondary hover:text-white'
          }`}
        >
          <span>Entregados</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">{deliveredList.length}</span>
        </button>
      </div>

      {/* List of Orders */}
      <div className="space-y-4">
        {activeTab === 'READY' && (
          <>
            {readyList.length === 0 ? (
              <div className="h-48 border border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center text-text-tertiary gap-2">
                <PackageCheck className="w-8 h-8 opacity-30" />
                <span className="text-xs">No hay pedidos listos para despachar</span>
              </div>
            ) : (
              readyList.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-lg bg-surface-1 border border-white/10 p-4 shadow-card flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black font-mono text-amber">{ord.code}</span>
                      <span className="text-xs font-bold text-text-primary">{ord.customerName}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-pill bg-emerald/20 text-emerald text-[11px] font-bold font-mono">
                      PAGADO ${ord.totalAmount.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-surface-2 rounded-md p-3 space-y-1.5 text-xs">
                    <div className="flex items-start gap-2 text-text-primary font-medium">
                      <MapPin className="w-4 h-4 text-amber shrink-0 mt-0.5" />
                      <span>{ord.deliveryAddress}</span>
                    </div>
                    {ord.customerPhone && (
                      <div className="flex items-center gap-2 text-text-secondary">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>{ord.customerPhone}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-text-secondary border-t border-white/5 pt-2">
                    <span className="font-semibold text-text-tertiary">Ítems: </span>
                    {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                  </div>

                  <button
                    onClick={() => handleStartTransit(ord.id)}
                    className="w-full h-10 rounded-pill bg-amber text-black hover:bg-amber-hover font-bold text-xs flex items-center justify-center gap-2 shadow-glowAmber transition active:scale-95"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Iniciar Reparto (En Camino)</span>
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'IN_TRANSIT' && (
          <>
            {inTransitList.length === 0 ? (
              <div className="h-48 border border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center text-text-tertiary gap-2">
                <Bike className="w-8 h-8 opacity-30" />
                <span className="text-xs">No tienes pedidos en tránsito</span>
              </div>
            ) : (
              inTransitList.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-lg bg-surface-1 border-2 border-amber/40 p-4 shadow-glowAmber flex flex-col gap-3 animate-slide-in"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black font-mono text-amber">{ord.code}</span>
                      <span className="text-xs font-bold text-white">{ord.customerName}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-pill bg-amber text-black text-[10px] font-black uppercase tracking-wider animate-pulse">
                      EN CAMINO
                    </span>
                  </div>

                  <div className="bg-surface-2 rounded-md p-3 space-y-2 text-xs">
                    <div className="flex items-start gap-2 text-white font-bold text-sm">
                      <MapPin className="w-4 h-4 text-amber shrink-0 mt-0.5" />
                      <span>{ord.deliveryAddress}</span>
                    </div>
                    {ord.customerPhone && (
                      <a
                        href={`tel:${ord.customerPhone}`}
                        className="inline-flex items-center gap-2 text-amber hover:underline font-mono"
                      >
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>Llamar al cliente ({ord.customerPhone})</span>
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => handleConfirmDelivery(ord.id)}
                    className="w-full h-11 rounded-pill bg-emerald text-white hover:bg-emerald-muted font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-glowEmerald transition active:scale-95"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Confirmar Entrega en Domicilio</span>
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'DELIVERED' && (
          <>
            {deliveredList.length === 0 ? (
              <div className="h-48 border border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center text-text-tertiary gap-2">
                <CheckCircle2 className="w-8 h-8 opacity-30" />
                <span className="text-xs">No hay entregas completadas en este turno</span>
              </div>
            ) : (
              deliveredList.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-lg bg-surface-1/60 border border-white/5 p-4 flex items-center justify-between opacity-80"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono text-emerald">{ord.code}</span>
                      <span className="text-xs font-semibold">{ord.customerName}</span>
                    </div>
                    <div className="text-[11px] text-text-tertiary mt-0.5">{ord.deliveryAddress}</div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-emerald">
                      ${ord.totalAmount.toLocaleString()}
                    </span>
                    <div className="text-[10px] text-emerald font-semibold">Entregado ✓</div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
