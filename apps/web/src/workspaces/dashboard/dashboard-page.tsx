import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAppContext } from '../../hooks/useContextState';
import { useSse } from '../../hooks/useSse';
import {
  TrendingUp,
  DollarSign,
  Clock,
  Users,
  Flame,
  ChefHat,
  CreditCard,
  Banknote,
  QrCode,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Award,
  Package,
  Activity,
} from 'lucide-react';

export interface LiveOperationsReport {
  timestamp: string;
  salon: {
    totalTables: number;
    occupiedTables: number;
    availableTables: number;
    occupancyRate: number;
    seatedGuests: number;
    avgTableDurationMinutes: number;
    waitingCustomers: number;
  };
  waiters: {
    activeWaitersCount: number;
    pendingServiceTasksCount: number;
    waiterLoad: Array<{ waiterId: string; tablesCount: number }>;
  };
  kitchen: {
    pendingOrdersCount: number;
    inPrepOrdersCount: number;
    readyOrdersCount: number;
    delayedOrdersCount: number;
    avgPrepTimeMinutes: number;
  };
  financials: {
    totalRevenueShift: number;
    paidAmountShift: number;
    pendingBalanceShift: number;
    closedAccountsCount: number;
    openAccountsCount: number;
    avgTicketPerTable: number;
    paymentMethodsBreakdown: {
      cash: number;
      card: number;
      qr: number;
      transfer: number;
    };
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    totalAmount: number;
  }>;
  inventoryAlertsCount: number;
}

export interface LiveQrItem {
  customerId: string;
  customerName: string;
  email: string | null;
  phone: string | null;
  code: string;
  channel: 'SALON' | 'TAKEAWAY' | 'DELIVERY';
  location: string;
  status: string;
  totalAmount: number;
  updatedAt: string;
}

export function DashboardPage() {
  const { restaurantId, authToken } = useAppContext();
  const { request } = useApi();

  const [report, setReport] = useState<LiveOperationsReport | null>(null);
  const [liveQrs, setLiveQrs] = useState<LiveQrItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLiveMetrics = useCallback(async () => {
    setLoading(true);
    const [opsRes, qrsRes] = await Promise.all([
      request<LiveOperationsReport>(`/api/analytics/live-operations?restaurantId=${restaurantId}`),
      request<LiveQrItem[]>(`/api/analytics/live-qrs?restaurantId=${restaurantId}`),
    ]);
    if (opsRes.data) {
      setReport(opsRes.data);
    }
    if (qrsRes.data) {
      setLiveQrs(qrsRes.data);
    }
    setLoading(false);
  }, [request, restaurantId]);

  useEffect(() => {
    fetchLiveMetrics();
  }, [fetchLiveMetrics]);

  // Live SSE real-time updates
  useSse({
    token: authToken,
    eventTypes: [
      'TABLE_ASSIGNED',
      'TABLE_CHANGED',
      'TABLE_RELEASED',
      'TABLE_CLOSED',
      'ORDER_CONFIRMED',
      'ORDER_SENT_TO_KITCHEN',
      'ORDER_READY',
      'ORDER_DELIVERED',
      'ACCOUNT_REQUESTED',
      'PAYMENT_REGISTERED',
      'ACCOUNT_CLOSED',
      'SERVICE_TASK_CREATED',
    ],
    onEvent: () => {
      fetchLiveMetrics();
    },
    onReconnect: () => {
      fetchLiveMetrics();
    },
  });

  const salon = report?.salon || {
    totalTables: 8,
    occupiedTables: 0,
    availableTables: 8,
    occupancyRate: 0,
    seatedGuests: 0,
    avgTableDurationMinutes: 0,
    waitingCustomers: 0,
  };

  const kitchen = report?.kitchen || {
    pendingOrdersCount: 0,
    inPrepOrdersCount: 0,
    readyOrdersCount: 0,
    delayedOrdersCount: 0,
    avgPrepTimeMinutes: 12,
  };

  const financials = report?.financials || {
    totalRevenueShift: 0,
    paidAmountShift: 0,
    pendingBalanceShift: 0,
    closedAccountsCount: 0,
    openAccountsCount: 0,
    avgTicketPerTable: 0,
    paymentMethodsBreakdown: { cash: 0, card: 0, qr: 0, transfer: 0 },
  };

  const paymentTotal =
    financials.paymentMethodsBreakdown.cash +
    financials.paymentMethodsBreakdown.card +
    financials.paymentMethodsBreakdown.qr +
    financials.paymentMethodsBreakdown.transfer;

  return (
    <div className="min-h-screen bg-background text-text-primary p-4 lg:p-6 pb-24">
      {/* Header Bar */}
      <header className="glass sticky top-0 z-20 rounded-lg px-5 h-[64px] flex items-center justify-between mb-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-amber text-black flex items-center justify-center font-bold shadow-glowAmber">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Dashboard Operativo en Vivo</h1>
            <p className="text-xs text-text-tertiary">Métricas gerenciales y dinamismo de salón, cocina y facturación</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-emerald bg-emerald/10 border border-emerald/20 px-3 py-1 rounded-pill">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
            <span>EN DIRECTO</span>
          </span>

          <button
            onClick={fetchLiveMetrics}
            disabled={loading}
            className="h-9 px-3 rounded-pill glass hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
            title="Refrescar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refrescar</span>
          </button>
        </div>
      </header>

      {/* Critical Stock Alert Banner (if any) */}
      {(report?.inventoryAlertsCount || 0) > 0 && (
        <div className="glass-strong border border-crimson/40 rounded-md p-3.5 mb-6 flex items-center justify-between shadow-glowCrimson animate-slide-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-crimson text-white flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-crimson">Alerta de Stock Crítico</div>
              <div className="text-sm font-semibold">
                Hay {report?.inventoryAlertsCount} insumo(s) por debajo del stock de seguridad
              </div>
            </div>
          </div>
          <span className="text-xs font-bold text-crimson font-mono px-3 py-1 rounded-pill bg-crimson/15 border border-crimson/30">
            REVISAR INSUMOS
          </span>
        </div>
      )}

      {/* Main KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Facturación del Turno */}
        <div className="rounded-md bg-surface-1 border border-white/5 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-tertiary mb-2">
            <span className="text-[11px] uppercase tracking-wider font-bold">Facturación Turno</span>
            <DollarSign className="w-4 h-4 text-emerald" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald mt-0.5">
            ${financials.totalRevenueShift.toLocaleString()}
          </div>
          <div className="text-[11px] text-text-tertiary mt-2 flex justify-between">
            <span>Cobrado: ${financials.paidAmountShift.toLocaleString()}</span>
            <span className="text-amber font-mono font-bold">
              {financials.closedAccountsCount} mesas cerradas
            </span>
          </div>
        </div>

        {/* Ocupación de Salón */}
        <div className="rounded-md bg-surface-1 border border-white/5 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-tertiary mb-2">
            <span className="text-[11px] uppercase tracking-wider font-bold">Ocupación Salón</span>
            <Users className="w-4 h-4 text-amber" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold font-mono text-text-primary">{salon.occupancyRate}%</div>
            <span className="text-xs text-text-tertiary font-mono">
              ({salon.occupiedTables}/{salon.totalTables} mesas)
            </span>
          </div>
          <div className="text-[11px] text-text-tertiary mt-2 flex justify-between">
            <span>{salon.seatedGuests} comensales</span>
            <span className="text-amber font-mono">{salon.waitingCustomers} en espera</span>
          </div>
        </div>

        {/* Tiempo Promedio de Mesa */}
        <div className="rounded-md bg-surface-1 border border-white/5 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-tertiary mb-2">
            <span className="text-[11px] uppercase tracking-wider font-bold">Permanencia Promedio</span>
            <Clock className="w-4 h-4 text-amber-hover" />
          </div>
          <div className="text-2xl font-bold font-mono text-text-primary">
            {salon.avgTableDurationMinutes} min
          </div>
          <div className="text-[11px] text-text-tertiary mt-2 flex justify-between">
            <span>Ticket prom.: ${financials.avgTicketPerTable.toLocaleString()}</span>
          </div>
        </div>

        {/* Cocina & Marcha */}
        <div className="rounded-md bg-surface-1 border border-white/5 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-tertiary mb-2">
            <span className="text-[11px] uppercase tracking-wider font-bold">Cocina KDS</span>
            <Flame className="w-4 h-4 text-orange" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold font-mono text-text-primary">
              {kitchen.inPrepOrdersCount + kitchen.pendingOrdersCount}
            </div>
            <span className="text-xs text-text-tertiary font-mono">pedidos activos</span>
          </div>
          <div className="text-[11px] mt-2 flex justify-between">
            <span className="text-text-tertiary">Prom. cocción: {kitchen.avgPrepTimeMinutes} min</span>
            {kitchen.delayedOrdersCount > 0 && (
              <span className="text-crimson font-bold font-mono animate-pulse">
                {kitchen.delayedOrdersCount} demorados
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Section: Left Payment Breakdown, Right Top Consumed Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Payment Methods Breakdown (60%) */}
        <section className="lg:col-span-7 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber" />
              <h2 className="text-sm font-bold">Desglose de Cobros por Medio de Pago</h2>
            </div>
            <span className="text-xs font-mono font-bold text-emerald">
              ${paymentTotal.toLocaleString()} total
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="glass rounded-md p-3.5">
              <div className="flex items-center justify-between text-xs text-text-tertiary mb-1">
                <span className="flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-emerald" />
                  <span>Efectivo</span>
                </span>
                <span className="font-mono">
                  {paymentTotal > 0 ? Math.round((financials.paymentMethodsBreakdown.cash / paymentTotal) * 100) : 0}%
                </span>
              </div>
              <div className="text-lg font-bold font-mono text-text-primary">
                ${financials.paymentMethodsBreakdown.cash.toLocaleString()}
              </div>
            </div>

            <div className="glass rounded-md p-3.5">
              <div className="flex items-center justify-between text-xs text-text-tertiary mb-1">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-amber" />
                  <span>Tarjeta</span>
                </span>
                <span className="font-mono">
                  {paymentTotal > 0 ? Math.round((financials.paymentMethodsBreakdown.card / paymentTotal) * 100) : 0}%
                </span>
              </div>
              <div className="text-lg font-bold font-mono text-text-primary">
                ${financials.paymentMethodsBreakdown.card.toLocaleString()}
              </div>
            </div>

            <div className="glass rounded-md p-3.5">
              <div className="flex items-center justify-between text-xs text-text-tertiary mb-1">
                <span className="flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-orange" />
                  <span>QR Digital</span>
                </span>
                <span className="font-mono">
                  {paymentTotal > 0 ? Math.round((financials.paymentMethodsBreakdown.qr / paymentTotal) * 100) : 0}%
                </span>
              </div>
              <div className="text-lg font-bold font-mono text-text-primary">
                ${financials.paymentMethodsBreakdown.qr.toLocaleString()}
              </div>
            </div>

            <div className="glass rounded-md p-3.5">
              <div className="flex items-center justify-between text-xs text-text-tertiary mb-1">
                <span className="flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-white/50" />
                  <span>Transferencia</span>
                </span>
                <span className="font-mono">
                  {paymentTotal > 0 ? Math.round((financials.paymentMethodsBreakdown.transfer / paymentTotal) * 100) : 0}%
                </span>
              </div>
              <div className="text-lg font-bold font-mono text-text-primary">
                ${financials.paymentMethodsBreakdown.transfer.toLocaleString()}
              </div>
            </div>
          </div>
        </section>

        {/* Top Platos Más Consumidos (40%) */}
        <section className="lg:col-span-5 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber" />
              <h2 className="text-sm font-bold">Top Platos del Turno</h2>
            </div>
            <span className="text-xs font-mono text-text-tertiary">Demanda en vivo</span>
          </div>

          <div className="space-y-2.5">
            {(report?.topProducts || []).length === 0 ? (
              <div className="h-40 border border-dashed border-white/10 rounded-md flex flex-col items-center justify-center text-text-tertiary gap-2">
                <Package className="w-6 h-6 opacity-30" />
                <span className="text-xs">Sin comandas procesadas aún</span>
              </div>
            ) : (
              (report?.topProducts || []).map((p, idx) => (
                <div
                  key={p.productId}
                  className="rounded-xs bg-surface-2 border border-white/5 p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber/15 text-amber text-xs font-bold font-mono flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-text-primary">{p.productName}</div>
                      <div className="text-[11px] font-mono text-text-tertiary">{p.quantitySold} unidades vendidas</div>
                    </div>
                  </div>
                  <span className="text-mono text-xs font-bold text-amber">${p.totalAmount.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Monitor de QRs Vivos Únicos (Fase 2.5) */}
      <section className="mt-6 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-amber" />
            <h2 className="text-sm font-bold">Monitor de QRs Vivos Únicos en Tiempo Real</h2>
          </div>
          <span className="text-xs font-mono font-bold text-emerald flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald animate-ping" />
            <span>Sincronizado por SSE</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-text-tertiary font-mono uppercase text-[10px]">
                <th className="pb-2">Cliente</th>
                <th className="pb-2">Email (Gmail)</th>
                <th className="pb-2">Teléfono / Destino</th>
                <th className="pb-2">Canal / Decisión</th>
                <th className="pb-2">Código QR</th>
                <th className="pb-2">Estado del Token</th>
                <th className="pb-2 text-right">Monto</th>
                <th className="pb-2 text-right">Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {liveQrs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-text-tertiary">
                    Sin comensales con QR vivo activo en este momento. Los pedidos y pre-órdenes aparecerán en tiempo real.
                  </td>
                </tr>
              ) : (
                liveQrs.map((item) => (
                  <tr key={item.customerId} className="hover:bg-white/5 transition">
                    <td className="py-2.5 font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber" />
                      <span>{item.customerName}</span>
                    </td>
                    <td className="py-2.5 text-text-secondary">
                      {item.email || <span className="text-text-tertiary italic">—</span>}
                    </td>
                    <td className="py-2.5 text-text-secondary">
                      {item.phone || item.location || <span className="text-text-tertiary italic">—</span>}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-pill text-[10px] font-bold ${
                          item.channel === 'SALON'
                            ? 'bg-amber/15 text-amber border border-amber/30'
                            : item.channel === 'TAKEAWAY'
                            ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                            : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                        }`}
                      >
                        {item.channel === 'SALON' ? '🍽️ Salón' : item.channel === 'TAKEAWAY' ? '🛍️ Retiro' : '🛵 Delivery'}
                      </span>
                    </td>
                    <td className="py-2.5 font-bold font-mono text-amber">
                      {item.code}
                    </td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded-pill bg-surface-2 text-emerald text-[10px] font-bold border border-emerald/20">
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-bold text-amber">
                      ${item.totalAmount.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right text-text-tertiary text-[11px]">
                      {new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
